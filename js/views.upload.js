// views.upload.js
const UploadView = (() => {
  let pastedHeaders = {}; // { White, Black, Result, ... } parsed from a pasted PGN export
  let detected = { color: null, result: null };

  const RESULT_VALUES = ['1-0', '0-1', '1/2-1/2', '*'];
  const RESULT_LABELS = {
    '1-0': '1-0 (White won)',
    '0-1': '0-1 (Black won)',
    '1/2-1/2': 'a draw',
    '*': 'an unknown result',
  };

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

  // a bare PGN (no header tags) still ends its movetext with the result token
  function extractTrailingResult(movetext) {
    const m = movetext.trim().match(/(1-0|0-1|1\/2-1\/2|\*)\s*$/);
    return m ? m[1] : null;
  }

  // works out who played and the result from the pasted PGN, matching the
  // saved username against the White/Black header tags — no manual picking
  function detectFromPgn(raw) {
    const hasHeaders = /\[\w+\s+"/.test(raw);
    const { headers, movetext } = hasHeaders ? parsePgnHeaders(raw) : { headers: {}, movetext: raw.trim() };
    const result = RESULT_VALUES.includes(headers.Result) ? headers.Result : extractTrailingResult(movetext);

    const username = (Storage.getSettings().username || '').trim().toLowerCase();
    let color = null;
    let reason = null;
    if (!username) {
      reason = 'Add your username in Settings so New Game can detect which color you played.';
    } else if ((headers.White || '').trim().toLowerCase() === username) {
      color = 'w';
    } else if ((headers.Black || '').trim().toLowerCase() === username) {
      color = 'b';
    } else if (headers.White || headers.Black) {
      reason = 'Your Settings username doesn\'t match either player in this PGN\'s headers.';
    } else {
      reason = 'This PGN has no player-name headers — paste the full export (with the White/Black tags) so New Game can detect your color.';
    }

    return { headers, movetext, result, color, reason };
  }

  function render(root) {
    pastedHeaders = {};
    detected = { color: null, result: null };
    root.innerHTML = `
      <h1 class="page-title">New game</h1>
      <p class="page-sub">Paste your game's PGN export below — we'll detect who played and the result for you to confirm.</p>

      <div class="panel">
        <h2 class="section-title">Confirm PGN</h2>
        <div class="field">
          <label class="field-label">Paste your PGN export here (edit if anything looks wrong)</label>
          <textarea id="pgnBox" rows="6" placeholder="1. e4 e5 2. Nf3 Nc6 ..."></textarea>
        </div>
        <div class="field" style="max-width:240px;">
          <label class="field-label">Time control</label>
          <select id="timeControlSelect">
            <option value="bullet">Bullet (&lt;3 min)</option>
            <option value="blitz">Blitz (3–10 min)</option>
            <option value="rapid" selected>Rapid (10–30 min)</option>
            <option value="classical">Classical (30+ min)</option>
          </select>
        </div>
        <p style="font-size:12px;color:var(--ivory-dim);margin-top:-8px;">
          Your rating isn't asked for — the coach estimates it from how you actually played this game, calibrated to the time control above.
        </p>
        <div id="detectionSummary" style="font-size:13px;color:var(--ivory-dim);margin:14px 0;"></div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ivory-dim);margin-bottom:14px;cursor:pointer;">
          <input type="checkbox" id="confirmCheckbox" disabled>
          <span id="confirmLabel">Paste your PGN above to detect who played, and the result.</span>
        </label>
        <button class="btn solid" id="reviewBtn" disabled>Run game review</button>
        <span id="reviewStatus" style="font-size:13px;color:var(--ivory-dim);margin-left:10px;"></span>
      </div>
    `;

    const pgnBox = root.querySelector('#pgnBox');
    const detectionSummary = root.querySelector('#detectionSummary');
    const confirmCheckbox = root.querySelector('#confirmCheckbox');
    const confirmLabel = root.querySelector('#confirmLabel');
    const reviewBtn = root.querySelector('#reviewBtn');

    function refreshDetection() {
      const raw = pgnBox.value;
      if (!raw.trim()) {
        detected = { color: null, result: null };
        detectionSummary.textContent = '';
        confirmCheckbox.checked = false;
        confirmCheckbox.disabled = true;
        confirmLabel.textContent = 'Paste your PGN above to detect who played, and the result.';
        reviewBtn.disabled = true;
        return;
      }

      const { headers, movetext, result, color, reason } = detectFromPgn(raw);
      pastedHeaders = { ...pastedHeaders, ...headers };
      if (movetext && movetext !== raw) pgnBox.value = movetext;
      detected = { color, result };

      if (color && result) {
        const colorLabel = color === 'w' ? 'White' : 'Black';
        const opponent = color === 'w' ? (pastedHeaders.Black || 'your opponent') : (pastedHeaders.White || 'your opponent');
        detectionSummary.innerHTML = `Detected: you played <strong>${colorLabel}</strong> vs ${opponent} — <strong>${RESULT_LABELS[result] || result}</strong>.`;
        confirmCheckbox.disabled = false;
        confirmLabel.textContent = 'This is correct.';
      } else {
        detectionSummary.textContent = reason || 'Could not detect the result from this PGN — check the pasted text.';
        confirmCheckbox.checked = false;
        confirmCheckbox.disabled = true;
        confirmLabel.textContent = 'This is correct.';
      }
      reviewBtn.disabled = !confirmCheckbox.checked;
    }

    pgnBox.addEventListener('blur', refreshDetection);
    pgnBox.addEventListener('input', () => {
      confirmCheckbox.checked = false;
      confirmCheckbox.disabled = true;
      reviewBtn.disabled = true;
      detectionSummary.textContent = 'Click outside the box to re-check the pasted PGN…';
    });
    confirmCheckbox.addEventListener('change', () => {
      reviewBtn.disabled = !confirmCheckbox.checked;
    });

    reviewBtn.addEventListener('click', async () => {
      refreshDetection();
      const pgn = pgnBox.value.trim();
      if (!pgn) { App.toast('Paste your game\'s PGN first.'); return; }
      if (!detected.color || !detected.result) { App.toast('Could not detect who played or the result — check the pasted PGN.'); return; }
      if (!confirmCheckbox.checked) { App.toast('Confirm the detected details first.'); return; }

      const settings = Storage.getSettings();
      if (!settings.apiKey) { App.toast('Add your API key in Settings first.'); App.goto('settings'); return; }

      const reviewStatus = root.querySelector('#reviewStatus');
      reviewBtn.disabled = true;
      reviewStatus.innerHTML = '<span class="spinner"></span> Analyzing your game… this can take a bit.';

      const playerColor = detected.color;
      const result = detected.result;
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
      } finally {
        reviewBtn.disabled = !confirmCheckbox.checked;
      }
    });
  }

  return { render };
})();
