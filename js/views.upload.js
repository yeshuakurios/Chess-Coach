// views.upload.js
const UploadView = (() => {
  let pastedHeaders = {}; // { White, Black, Result, ... } parsed from a pasted PGN export

  const RESULT_VALUES = ['1-0', '0-1', '1/2-1/2', '*'];

  // strips PGN header tag pairs (e.g. [White "..."]) out of pasted text like a
  // chess.com export, returning the remaining movetext plus the parsed headers
  function parsePgnHeaders(raw) {
    const headers = {};
    const movetext = raw.replace(/\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*/g, (_m, key, val) => {
      headers[key] = val.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      return '';
    }).trim();
    return { headers, movetext };
  }

  // matches the saved username against a parsed PGN's White/Black tags to fill
  // in the player's color and result without asking for them by hand
  function applyHeaderDetection(headers, root) {
    if (RESULT_VALUES.includes(headers.Result)) {
      root.querySelector('#resultSelect').value = headers.Result;
    }
    const username = (Storage.getSettings().username || '').trim().toLowerCase();
    if (!username) return;
    if ((headers.White || '').trim().toLowerCase() === username) {
      root.querySelector('#playerColor').value = 'w';
    } else if ((headers.Black || '').trim().toLowerCase() === username) {
      root.querySelector('#playerColor').value = 'b';
    }
  }

  function render(root) {
    pastedHeaders = {};
    root.innerHTML = `
      <h1 class="page-title">New game</h1>
      <p class="page-sub">Paste your game's PGN export below.</p>

      <div class="panel">
        <h2 class="section-title">Paste PGN</h2>
        <div class="field">
          <label class="field-label">Paste your PGN export here (edit if anything looks wrong)</label>
          <textarea id="pgnBox" rows="6" placeholder="1. e4 e5 2. Nf3 Nc6 ..."></textarea>
        </div>
        <div class="grid-3">
          <div class="field">
            <label class="field-label">I played</label>
            <select id="playerColor">
              <option value="w">White</option>
              <option value="b">Black</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">Result</label>
            <select id="resultSelect">
              <option value="1-0">1-0 (White won)</option>
              <option value="0-1">0-1 (Black won)</option>
              <option value="1/2-1/2">Draw</option>
              <option value="*">Unknown</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">Time control</label>
            <select id="timeControlSelect">
              <option value="bullet">Bullet (&lt;3 min)</option>
              <option value="blitz">Blitz (3–10 min)</option>
              <option value="rapid" selected>Rapid (10–30 min)</option>
              <option value="classical">Classical (30+ min)</option>
            </select>
          </div>
        </div>
        <p style="font-size:12px;color:var(--ivory-dim);margin-top:-8px;">
          Your rating isn't asked for — the coach estimates it from how you actually played this game, calibrated to the time control above.
        </p>
        <button class="btn solid" id="reviewBtn">Run game review</button>
        <span id="reviewStatus" style="font-size:13px;color:var(--ivory-dim);margin-left:10px;"></span>
      </div>
    `;

    const pgnBox = root.querySelector('#pgnBox');

    pgnBox.addEventListener('blur', () => {
      const raw = pgnBox.value;
      if (!/\[\w+\s+"/.test(raw)) return;
      const { headers, movetext } = parsePgnHeaders(raw);
      if (!movetext) return;
      pastedHeaders = { ...pastedHeaders, ...headers };
      pgnBox.value = movetext;
      applyHeaderDetection(headers, root);
      App.toast('Detected a full PGN export — filled in details from its headers.');
    });

    root.querySelector('#reviewBtn').addEventListener('click', async () => {
      let pgn = pgnBox.value.trim();
      if (/\[\w+\s+"/.test(pgn)) {
        const { headers, movetext } = parsePgnHeaders(pgn);
        pastedHeaders = { ...pastedHeaders, ...headers };
        pgn = movetext;
        pgnBox.value = pgn;
        applyHeaderDetection(headers, root);
      }
      if (!pgn) { App.toast('Paste your game\'s PGN first.'); return; }
      const settings = Storage.getSettings();
      if (!settings.apiKey) { App.toast('Add your API key in Settings first.'); App.goto('settings'); return; }

      const reviewStatus = root.querySelector('#reviewStatus');
      const reviewBtn = root.querySelector('#reviewBtn');
      reviewBtn.disabled = true;
      reviewStatus.innerHTML = '<span class="spinner"></span> Analyzing your game… this can take a bit.';

      const playerColor = root.querySelector('#playerColor').value;
      const result = root.querySelector('#resultSelect').value;
      const timeControl = root.querySelector('#timeControlSelect').value;

      try {
        const review = await ClaudeAPI.reviewGame(pgn, playerColor, timeControl);
        const gameId = Storage.uid();

        const mistakes = (review.moves || []).map(m => ({
          id: Storage.uid(),
          ply: m.ply,
          san: m.san,
          fenBefore: m.fenBefore,
          classification: m.classification,
          comment: m.comment,
          betterMove: m.betterMove,
          betterMoveExplanation: m.betterMoveExplanation,
          category: m.category || 'other',
        }));

        const game = {
          id: gameId,
          date: new Date().toISOString(),
          pgn,
          white: pastedHeaders.White || (playerColor === 'w' ? 'Me' : 'Opponent'),
          black: pastedHeaders.Black || (playerColor === 'b' ? 'Me' : 'Opponent'),
          playerColor,
          result,
          timeControl,
          review,
          mistakes,
        };
        Storage.saveGame(game);

        // record the coach's per-game Elo estimate under this time control
        if (typeof review.estimatedElo === 'number') {
          Storage.addEloEstimate(timeControl, review.estimatedElo, gameId);
        }

        // create puzzles from real mistakes/blunders (skip inaccuracies to keep puzzle quality high)
        const puzzleWorthy = mistakes.filter(m => m.classification === 'mistake' || m.classification === 'blunder');
        const profile = Storage.getProfile();
        const puzzles = puzzleWorthy.map(m => ({
          id: Storage.uid(),
          gameId,
          mistakeId: m.id,
          fen: m.fenBefore,
          solution: m.betterMove,
          category: m.category,
          severity: m.classification,
          playerColor,
          attempts: 0,
          solved: false,
          createdAt: new Date().toISOString(),
          puzzleEloAtCreation: profile.puzzleElo,
        }));
        Storage.savePuzzles(puzzles);

        reviewStatus.textContent = '';
        const eloNote = typeof review.estimatedElo === 'number' ? ` · estimated ${timeControl} Elo ${review.estimatedElo}` : '';
        App.toast(`Review ready — ${puzzles.length} puzzle${puzzles.length === 1 ? '' : 's'} generated${eloNote}.`);
        App.goto('review', { gameId });
      } catch (e) {
        console.error(e);
        reviewStatus.textContent = 'Review failed: ' + e.message;
      }
      reviewBtn.disabled = false;
    });
  }

  return { render };
})();
