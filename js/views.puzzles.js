// views.puzzles.js
const PuzzlesView = (() => {
  let currentPuzzle = null;
  let boardInstance = null;
  let resolved = false;

  function normalizeSan(san) {
    return (san || '').replace(/[+#!?]/g, '').trim();
  }

  function render(root, params) {
    const puzzles = Storage.getPuzzles();
    const queue = puzzles.filter(p => !p.solved);

    if (queue.length === 0) {
      root.innerHTML = `
        <h1 class="page-title">Puzzles</h1>
        <p class="page-sub">Puzzles generated from your own real mistakes.</p>
        <div class="empty-state panel">
          <div class="glyph">♞</div>
          <p>No puzzles waiting. Upload and review a game — mistakes and blunders automatically become puzzles here.</p>
        </div>
        ${renderSolvedHistory(puzzles)}
      `;
      return;
    }

    const pick = params?.puzzleId ? queue.find(p => p.id === params.puzzleId) : queue[0];
    currentPuzzle = pick || queue[0];
    resolved = false;

    root.innerHTML = `
      <h1 class="page-title">Puzzles</h1>
      <p class="page-sub">${queue.length} puzzle${queue.length === 1 ? '' : 's'} waiting · find the move you missed.</p>

      <div class="grid-2">
        <div class="panel">
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <span class="tag ${currentPuzzle.severity}">${currentPuzzle.severity}</span>
            <span class="tag" style="background:rgba(199,154,75,0.12);color:var(--ivory-dim);">${(currentPuzzle.category||'').replace(/_/g,' ')}</span>
          </div>
          <div id="puzzleBoard"></div>
          <div id="puzzleFeedback" style="margin-top:14px;"></div>
        </div>
        <div class="panel">
          <h2 class="section-title">Queue</h2>
          ${queue.map(p => `
            <div class="list-item" style="cursor:pointer;" data-puzzle-id="${p.id}">
              <div>
                <span class="tag ${p.severity}">${p.severity}</span>
                <span style="margin-left:8px;font-size:13px;">${(p.category||'').replace(/_/g,' ')}</span>
              </div>
              <span class="meta">${p.attempts || 0} attempt${p.attempts === 1 ? '' : 's'}</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${renderSolvedHistory(puzzles)}
    `;

    root.querySelectorAll('[data-puzzle-id]').forEach(el => {
      el.addEventListener('click', () => App.goto('puzzles', { puzzleId: el.dataset.puzzleId }));
    });

    const boardEl = root.querySelector('#puzzleBoard');
    const feedbackEl = root.querySelector('#puzzleFeedback');

    boardInstance = createBoard(boardEl, {
      fen: currentPuzzle.fen,
      orientation: currentPuzzle.playerColor,
      interactive: true,
      onMove: (from, to, promotion, moveObj) => {
        if (resolved) return false;
        const correct = normalizeSan(moveObj.san) === normalizeSan(currentPuzzle.solution)
          || (moveObj.from + moveObj.to) === extractUci(currentPuzzle.solution);
        handleAttempt(correct, feedbackEl);
        return correct ? true : false; // wrong moves get undone visually
      },
    });
  }

  function extractUci() { return null; } // solution stored as SAN; UCI fallback unused for now

  function handleAttempt(correct, feedbackEl) {
    const puzzle = currentPuzzle;
    Storage.updatePuzzle(puzzle.id, { attempts: (puzzle.attempts || 0) + 1 });

    if (correct) {
      resolved = true;
      const profile = Storage.getProfile();
      const { newElo, delta } = EloCalc.updatePuzzleElo(profile.puzzleElo, puzzle.puzzleEloAtCreation || profile.puzzleElo, 1, profile.puzzlesSolved);
      profile.puzzleEloHistory.push({ date: new Date().toISOString(), elo: profile.puzzleElo });
      profile.puzzleElo = newElo;
      profile.puzzlesSolved += 1;
      Storage.saveProfile(profile);
      const xpGain = puzzle.severity === 'blunder' ? 30 : 20;
      Storage.addXP(xpGain);
      Storage.updatePuzzle(puzzle.id, { solved: true });

      feedbackEl.innerHTML = `
        <div class="note-box better">
          <strong>Solved!</strong> That's the move you missed in the actual game.
          <div style="margin-top:6px;color:var(--brass);">+${xpGain} XP · Puzzle Elo ${delta >= 0 ? '+' : ''}${delta} → ${newElo}</div>
        </div>
        <button class="btn solid" style="margin-top:12px;" id="nextPuzzleBtn">Next puzzle</button>
      `;
      feedbackEl.querySelector('#nextPuzzleBtn').addEventListener('click', () => App.goto('puzzles'));
    } else {
      feedbackEl.innerHTML = `<div class="note-box" style="border-left-color:var(--brick);">Not quite — try again.</div>`;
    }
  }

  function renderSolvedHistory(puzzles) {
    const solved = puzzles.filter(p => p.solved);
    if (solved.length === 0) return '';
    return `
      <div class="panel" style="margin-top:16px;">
        <h2 class="section-title">Solved (${solved.length})</h2>
        ${solved.slice(0, 8).map(p => `
          <div class="list-item">
            <div><span class="tag ${p.severity}">${p.severity}</span><span style="margin-left:8px;font-size:13px;">${(p.category||'').replace(/_/g,' ')}</span></div>
            <span class="meta">${p.attempts} attempt${p.attempts === 1 ? '' : 's'}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  return { render };
})();
