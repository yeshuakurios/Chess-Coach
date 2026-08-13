// board.js — renders an interactive board from a chess.js instance into a container.
const PIECE_GLYPH = {
  p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
  P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔',
};

function createBoard(containerEl, opts) {
  // opts: { fen, orientation: 'w'|'b', onMove: (from,to,promotion)=>bool, interactive: bool, sqpx }
  const state = {
    game: new Chess(opts.fen || undefined),
    orientation: opts.orientation || 'w',
    selected: null,
    lastMove: opts.lastMove || null,
    interactive: opts.interactive !== false,
  };

  containerEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'board-wrap';
  if (opts.sqpx) wrap.style.setProperty('--sqpx', opts.sqpx + 'px');
  const boardEl = document.createElement('div');
  boardEl.className = 'board';
  wrap.appendChild(boardEl);
  containerEl.appendChild(wrap);

  function files() { return state.orientation === 'w' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a']; }
  function ranks() { return state.orientation === 'w' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8]; }

  function render() {
    boardEl.innerHTML = '';
    const board = state.game.board(); // 8x8 array, [0]=rank8..[7]=rank1, each row a1..h1 order? chess.js: board()[0] is rank 8, row[0] is file a
    const f = files(), r = ranks();
    r.forEach((rank) => {
      f.forEach((file) => {
        const squareName = file + rank;
        const isLight = (file.charCodeAt(0) - 97 + rank) % 2 === 1;
        const cell = document.createElement('div');
        cell.className = 'cell ' + (isLight ? 'light' : 'dark');
        cell.dataset.square = squareName;

        if (state.lastMove && (squareName === state.lastMove.from)) cell.classList.add('from');
        if (state.lastMove && (squareName === state.lastMove.to)) cell.classList.add('to');
        if (state.selected === squareName) cell.classList.add('sel');

        const piece = state.game.get(squareName);
        if (piece) {
          const glyph = piece.color === 'w' ? PIECE_GLYPH[piece.type.toUpperCase()] : PIECE_GLYPH[piece.type];
          cell.innerHTML = `<span class="${piece.color === 'w' ? 'piece-w' : 'piece-b'}">${glyph}</span>`;
        }

        if (state.selected) {
          const moves = state.game.moves({ square: state.selected, verbose: true });
          if (moves.some(m => m.to === squareName)) cell.classList.add('target');
        }

        if (state.interactive) {
          cell.addEventListener('click', () => onCellClick(squareName));
        }
        boardEl.appendChild(cell);
      });
    });
  }

  function onCellClick(squareName) {
    const piece = state.game.get(squareName);
    if (state.selected) {
      if (state.selected === squareName) { state.selected = null; render(); return; }
      const moves = state.game.moves({ square: state.selected, verbose: true });
      const target = moves.find(m => m.to === squareName);
      if (target) {
        let promotion = undefined;
        if (target.flags.includes('p')) promotion = 'q'; // auto-queen for simplicity
        const from = state.selected, to = squareName;
        state.selected = null;
        const moveObj = state.game.move({ from, to, promotion });
        if (moveObj) {
          state.lastMove = { from, to };
          const keepGoing = opts.onMove ? opts.onMove(from, to, promotion, moveObj) : true;
          if (keepGoing === false) {
            state.game.undo();
            state.lastMove = null;
          }
        }
        render();
        return;
      }
      // clicking another own piece re-selects
      if (piece && piece.color === state.game.turn()) {
        state.selected = squareName; render(); return;
      }
      state.selected = null; render(); return;
    } else {
      if (piece && piece.color === state.game.turn()) {
        state.selected = squareName; render();
      }
    }
  }

  render();

  return {
    render,
    setFen(fen) { state.game = new Chess(fen); state.selected = null; state.lastMove = null; render(); },
    setLastMove(m) { state.lastMove = m; render(); },
    flip() { state.orientation = state.orientation === 'w' ? 'b' : 'w'; render(); },
    getGame() { return state.game; },
    setInteractive(v) { state.interactive = v; },
  };
}
