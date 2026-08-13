// views.review.js
const ReviewView = (() => {
  function render(root, params) {
    const games = Storage.getGames();
    if (games.length === 0) {
      root.innerHTML = `<h1 class="page-title">Review</h1><div class="empty-state panel"><div class="glyph">♟</div><p>No games yet — upload one to get a review.</p></div>`;
      return;
    }
    const gameId = params?.gameId || games[0].id;
    const game = Storage.getGame(gameId);
    if (!game) { root.innerHTML = `<p>Game not found.</p>`; return; }

    // build full move list with fen-before for each ply by replaying pgn
    const replay = new Chess();
    let fullMoves = [];
    try {
      const loaded = new Chess();
      loaded.load_pgn(game.pgn);
      const hist = loaded.history({ verbose: true });
      const stepper = new Chess();
      hist.forEach((h, i) => {
        const fenBefore = stepper.fen();
        stepper.move(h.san);
        fullMoves.push({ ply: i + 1, san: h.san, fenBefore, color: h.color });
      });
    } catch (e) {
      console.error('PGN replay failed', e);
    }

    const mistakeByPly = {};
    (game.mistakes || []).forEach(m => { mistakeByPly[m.ply] = m; });

    root.innerHTML = `
      <h1 class="page-title">Game review</h1>
      <p class="page-sub">${game.white} vs ${game.black} · ${new Date(game.date).toLocaleDateString()} · ${game.timeControl || 'rapid'} · ${game.result}</p>

      <div class="panel">
        <select id="gamePicker">
          ${games.map(g => `<option value="${g.id}" ${g.id === gameId ? 'selected' : ''}>${new Date(g.date).toLocaleDateString()} — ${g.white} vs ${g.black} (${g.result})</option>`).join('')}
        </select>
      </div>

      ${game.review?.summary ? `
      <div class="panel">
        <h2 class="section-title">Summary</h2>
        <p style="font-size:14px;line-height:1.6;color:var(--ivory-dim);">${game.review.summary}</p>
        ${typeof game.review.estimatedElo === 'number' ? `
        <div class="stat-card" style="margin-top:14px;max-width:340px;">
          <div class="stat-label">Estimated ${game.timeControl || 'rapid'} rating this game</div>
          <div class="stat-value" style="font-size:26px;">${game.review.estimatedElo}</div>
          ${game.review.estimatedEloReasoning ? `<div class="stat-delta" style="color:var(--ivory-dim);">${game.review.estimatedEloReasoning}</div>` : ''}
        </div>` : ''}
      </div>` : ''}

      ${game.review?.topWeakness ? `
      <div class="callout">
        <div class="glyph">♟</div>
        <div><h3>What to work on</h3><p>${game.review.topWeakness}</p></div>
      </div>` : ''}

      <div class="grid-2" style="margin-top:16px;">
        <div class="panel">
          <h2 class="section-title">Board</h2>
          <div id="reviewBoard"></div>
          <div id="moveDetail" style="margin-top:14px;"></div>
        </div>
        <div class="panel">
          <h2 class="section-title">Move list</h2>
          <div class="movelist" id="movelist"></div>
          <div style="margin-top:16px;display:flex;gap:8px;">
            <button class="btn small ghost" id="prevBtn">◂ Prev</button>
            <button class="btn small ghost" id="nextBtn">Next ▸</button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#gamePicker').addEventListener('change', (e) => {
      App.goto('review', { gameId: e.target.value });
    });

    const boardEl = root.querySelector('#reviewBoard');
    const detailEl = root.querySelector('#moveDetail');
    const movelistEl = root.querySelector('#movelist');

    let cursor = fullMoves.length; // position index (0 = start, N = after move N)
    const board = createBoard(boardEl, { fen: fullMoves[0]?.fenBefore, orientation: game.playerColor, interactive: false, sqpx: 46 });

    function classForMove(m) {
      const flag = mistakeByPly[m.ply];
      if (!flag) return '';
      return 'flag-' + flag.classification;
    }

    function renderMovelist() {
      let html = '';
      fullMoves.forEach((m, i) => {
        if (m.color === 'w') html += `<span class="mv-num">${Math.ceil(m.ply / 2)}.</span> `;
        html += `<span class="mv ${classForMove(m)} ${i + 1 === cursor ? 'active' : ''}" data-idx="${i}">${m.san}</span> `;
      });
      movelistEl.innerHTML = html || '<span style="color:var(--ivory-dim);">No moves parsed.</span>';
      movelistEl.querySelectorAll('.mv').forEach(el => {
        el.addEventListener('click', () => { cursor = parseInt(el.dataset.idx, 10) + 1; showPosition(); });
      });
    }

    function showPosition() {
      const atStart = cursor === 0;
      const fen = atStart ? fullMoves[0]?.fenBefore : (fullMoves[cursor - 1] ? afterFen(cursor - 1) : undefined);
      board.setFen(fen);
      if (cursor > 0) {
        const m = fullMoves[cursor - 1];
        board.setLastMove({ from: '', to: '' }); // fen already reflects the move; skip precise highlight
      }
      renderMovelist();
      renderDetail();
    }

    // compute fen after move index i (0-based) by replaying up to and including it
    const fenCache = {};
    function afterFen(i) {
      if (fenCache[i]) return fenCache[i];
      const g = new Chess();
      for (let k = 0; k <= i; k++) g.move(fullMoves[k].san);
      fenCache[i] = g.fen();
      return fenCache[i];
    }

    function renderDetail() {
      if (cursor === 0) { detailEl.innerHTML = '<p style="color:var(--ivory-dim);font-size:13px;">Start of game.</p>'; return; }
      const m = fullMoves[cursor - 1];
      const flag = mistakeByPly[m.ply];
      if (!flag) {
        detailEl.innerHTML = `<p style="color:var(--ivory-dim);font-size:13px;">Ply ${m.ply}: ${m.san} — no issues flagged.</p>`;
        return;
      }
      detailEl.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
          <span class="tag ${flag.classification}">${flag.classification}</span>
          <span style="font-family:var(--mono);font-size:13px;">${flag.san}</span>
          <span class="tag" style="background:rgba(199,154,75,0.12);color:var(--ivory-dim);">${(flag.category || '').replace(/_/g,' ')}</span>
        </div>
        <div class="note-box">${flag.comment || ''}</div>
        ${flag.betterMove ? `<div class="note-box better"><strong>Better: ${flag.betterMove}.</strong> ${flag.betterMoveExplanation || ''}</div>` : ''}
      `;
    }

    root.querySelector('#prevBtn').addEventListener('click', () => { cursor = Math.max(0, cursor - 1); showPosition(); });
    root.querySelector('#nextBtn').addEventListener('click', () => { cursor = Math.min(fullMoves.length, cursor + 1); showPosition(); });

    showPosition();
  }

  return { render };
})();
