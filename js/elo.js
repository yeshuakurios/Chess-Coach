// elo.js — standard Elo update math, used for puzzle rating changes.
const EloCalc = (() => {
  function expectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  // K scales down as puzzle count grows, like real puzzle-rating systems
  function kFactor(solvedCount) {
    if (solvedCount < 20) return 40;
    if (solvedCount < 100) return 24;
    return 16;
  }

  // score: 1 = solved, 0 = failed
  function updatePuzzleElo(playerElo, puzzleElo, score, solvedCount) {
    const expected = expectedScore(playerElo, puzzleElo);
    const k = kFactor(solvedCount);
    const delta = Math.round(k * (score - expected));
    return { newElo: playerElo + delta, delta };
  }

  return { expectedScore, kFactor, updatePuzzleElo };
})();
