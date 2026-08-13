// views.upload.js
const UploadView = (() => {
  let extracted = null; // { pgn, whiteElo, blackElo, white, black, result }
  let imageDataUrl = null;
  let pastedHeaders = {};

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

  function render(root) {
    extracted = null;
    imageDataUrl = null;
    pastedHeaders = {};
    root.innerHTML = `
      <h1 class="page-title">New game</h1>
      <p class="page-sub">Upload a screenshot of your move list, or paste PGN directly.</p>

      <div class="panel">
        <h2 class="section-title">1. Screenshot</h2>
        <div class="dropzone" id="dropzone">
          <div>Drop a screenshot here, or click to choose a file</div>
          <div style="font-size:12px;margin-top:6px;">PNG or JPG of a move list / game history</div>
          <img id="preview" style="display:none;">
        </div>
        <input type="file" id="fileInput" accept="image/*" style="display:none;">
        <div style="margin-top:14px;display:flex;gap:10px;align-items:center;">
          <button class="btn solid" id="extractBtn" disabled>Extract move list</button>
          <span id="extractStatus" style="font-size:13px;color:var(--ivory-dim);"></span>
        </div>
      </div>

      <div class="panel">
        <h2 class="section-title">2. Confirm PGN</h2>
        <div class="field">
          <label class="field-label">Move text (edit if anything looks wrong)</label>
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

    const dropzone = root.querySelector('#dropzone');
    const fileInput = root.querySelector('#fileInput');
    const preview = root.querySelector('#preview');
    const extractBtn = root.querySelector('#extractBtn');
    const extractStatus = root.querySelector('#extractStatus');
    const pgnBox = root.querySelector('#pgnBox');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault(); dropzone.classList.remove('drag');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

    pgnBox.addEventListener('blur', () => {
      const raw = pgnBox.value;
      if (!/\[\w+\s+"/.test(raw)) return;
      const { headers, movetext } = parsePgnHeaders(raw);
      if (!movetext) return;
      pastedHeaders = { ...pastedHeaders, ...headers };
      pgnBox.value = movetext;
      if (RESULT_VALUES.includes(headers.Result)) {
        root.querySelector('#resultSelect').value = headers.Result;
      }
      App.toast('Detected a full PGN export — filled in details from its headers.');
    });

    function handleFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        imageDataUrl = reader.result;
        preview.src = imageDataUrl;
        preview.style.display = 'block';
        extractBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    }

    extractBtn.addEventListener('click', async () => {
      const settings = Storage.getSettings();
      if (!settings.apiKey) {
        App.toast('Add your API key in Settings first.');
        App.goto('settings');
        return;
      }
      extractBtn.disabled = true;
      extractStatus.innerHTML = '<span class="spinner"></span> Reading screenshot…';
      try {
        const [, mediaType, base64] = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
        const result = await ClaudeAPI.extractPGNFromImage(base64, mediaType);
        extracted = result;
        pgnBox.value = result.pgn || '';
        if (result.result) root.querySelector('#resultSelect').value = result.result;
        extractStatus.textContent = 'Done — review the move text below.';
      } catch (e) {
        console.error(e);
        extractStatus.textContent = 'Could not read that screenshot: ' + e.message;
      }
      extractBtn.disabled = false;
    });

    root.querySelector('#reviewBtn').addEventListener('click', async () => {
      let pgn = pgnBox.value.trim();
      if (/\[\w+\s+"/.test(pgn)) {
        const { headers, movetext } = parsePgnHeaders(pgn);
        pastedHeaders = { ...pastedHeaders, ...headers };
        pgn = movetext;
        pgnBox.value = pgn;
        if (RESULT_VALUES.includes(headers.Result)) {
          root.querySelector('#resultSelect').value = headers.Result;
        }
      }
      if (!pgn) { App.toast('Add PGN or extract from a screenshot first.'); return; }
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
          white: extracted?.white || pastedHeaders.White || (playerColor === 'w' ? 'Me' : 'Opponent'),
          black: extracted?.black || pastedHeaders.Black || (playerColor === 'b' ? 'Me' : 'Opponent'),
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
