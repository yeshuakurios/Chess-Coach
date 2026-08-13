// storage.js — all persistence lives in localStorage. Keys prefixed "cc_".
const Storage = (() => {
  const KEYS = {
    games: 'cc_games',
    puzzles: 'cc_puzzles',
    profile: 'cc_profile',
    settings: 'cc_settings',
  };

  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Storage read error', key, e);
      return fallback;
    }
  }
  function _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const TIME_CONTROLS = ['bullet', 'blitz', 'rapid', 'classical'];

  // ---------- Profile ----------
  function getProfile() {
    const p = _get(KEYS.profile, {
      puzzleElo: 1000,
      puzzleEloHistory: [],
      xp: 0,
      level: 1,
      puzzlesSolved: 0,
      puzzlesFailed: 0,
      eloByTimeControl: { bullet: [], blitz: [], rapid: [], classical: [] },
    });
    // migrate older profiles that don't have eloByTimeControl yet
    if (!p.eloByTimeControl) p.eloByTimeControl = { bullet: [], blitz: [], rapid: [], classical: [] };
    TIME_CONTROLS.forEach(tc => { if (!p.eloByTimeControl[tc]) p.eloByTimeControl[tc] = []; });
    return p;
  }
  function saveProfile(p) { _set(KEYS.profile, p); }

  // record a per-game estimated rating under a time control, return updated profile
  function addEloEstimate(timeControl, elo, gameId) {
    const p = getProfile();
    const tc = TIME_CONTROLS.includes(timeControl) ? timeControl : 'rapid';
    p.eloByTimeControl[tc].push({ date: new Date().toISOString(), elo, gameId });
    saveProfile(p);
    return p;
  }

  function getAverageElo(timeControl, lastN) {
    const p = getProfile();
    const entries = p.eloByTimeControl[timeControl] || [];
    if (entries.length === 0) return null;
    const slice = lastN ? entries.slice(-lastN) : entries;
    const avg = slice.reduce((sum, e) => sum + e.elo, 0) / slice.length;
    return Math.round(avg);
  }

  // average of the most recent estimate vs the average of everything before it, for a trend arrow
  function getEloTrend(timeControl) {
    const p = getProfile();
    const entries = p.eloByTimeControl[timeControl] || [];
    if (entries.length < 2) return null;
    const latest = entries[entries.length - 1].elo;
    const priorAvg = entries.slice(0, -1).reduce((s, e) => s + e.elo, 0) / (entries.length - 1);
    return Math.round(latest - priorAvg);
  }

  function xpForNextLevel(level) {
    return 100 + (level - 1) * 60; // increasing curve
  }
  function addXP(amount) {
    const p = getProfile();
    p.xp += amount;
    let need = xpForNextLevel(p.level);
    while (p.xp >= need) {
      p.xp -= need;
      p.level += 1;
      need = xpForNextLevel(p.level);
    }
    saveProfile(p);
    return p;
  }

  // ---------- Settings ----------
  function getSettings() {
    const s = _get(KEYS.settings, { apiKey: '', model: 'claude-sonnet-5', username: '' });
    if (s.username === undefined) s.username = '';
    return s;
  }
  function saveSettings(s) { _set(KEYS.settings, s); }

  // ---------- Games ----------
  function getGames() { return _get(KEYS.games, []); }
  function saveGame(game) {
    const games = getGames();
    games.unshift(game);
    _set(KEYS.games, games);
  }
  function updateGame(id, patch) {
    const games = getGames();
    const idx = games.findIndex(g => g.id === id);
    if (idx >= 0) { games[idx] = { ...games[idx], ...patch }; _set(KEYS.games, games); }
  }
  function getGame(id) { return getGames().find(g => g.id === id); }
  function deleteGame(id) {
    _set(KEYS.games, getGames().filter(g => g.id !== id));
    _set(KEYS.puzzles, getPuzzles().filter(p => p.gameId !== id));
  }

  // ---------- Puzzles ----------
  function getPuzzles() { return _get(KEYS.puzzles, []); }
  function savePuzzles(newOnes) {
    const puzzles = getPuzzles();
    _set(KEYS.puzzles, [...newOnes, ...puzzles]);
  }
  function updatePuzzle(id, patch) {
    const puzzles = getPuzzles();
    const idx = puzzles.findIndex(p => p.id === id);
    if (idx >= 0) { puzzles[idx] = { ...puzzles[idx], ...patch }; _set(KEYS.puzzles, puzzles); }
  }

  // ---------- Aggregates ----------
  function getAllMistakes() {
    const mistakes = [];
    getGames().forEach(g => (g.mistakes || []).forEach(m => mistakes.push({ ...m, gameId: g.id, gameDate: g.date })));
    return mistakes;
  }

  function getWeaknessBreakdown() {
    const mistakes = getAllMistakes();
    const counts = {};
    mistakes.forEach(m => {
      const cat = m.category || 'uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  // weighted by recency: most recent 10 mistakes weighted higher
  function getTopWeakness() {
    const mistakes = getAllMistakes()
      .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));
    if (mistakes.length === 0) return null;
    const recent = mistakes.slice(0, 12);
    const weight = {};
    recent.forEach((m, i) => {
      const cat = m.category || 'uncategorized';
      const w = 12 - i; // more recent = heavier
      weight[cat] = (weight[cat] || 0) + w;
    });
    const sorted = Object.entries(weight).sort((a, b) => b[1] - a[1]);
    const topCat = sorted[0][0];
    const examples = recent.filter(m => (m.category || 'uncategorized') === topCat).slice(0, 3);
    return { category: topCat, count: mistakes.filter(m => (m.category || 'uncategorized') === topCat).length, examples };
  }

  function exportAll() {
    return {
      games: getGames(),
      puzzles: getPuzzles(),
      profile: getProfile(),
      exportedAt: new Date().toISOString(),
      version: 1,
    };
  }
  function importAll(data) {
    if (data.games) _set(KEYS.games, data.games);
    if (data.puzzles) _set(KEYS.puzzles, data.puzzles);
    if (data.profile) _set(KEYS.profile, data.profile);
  }

  return {
    uid,
    TIME_CONTROLS,
    getProfile, saveProfile, addXP, xpForNextLevel,
    addEloEstimate, getAverageElo, getEloTrend,
    getSettings, saveSettings,
    getGames, saveGame, updateGame, getGame, deleteGame,
    getPuzzles, savePuzzles, updatePuzzle,
    getAllMistakes, getWeaknessBreakdown, getTopWeakness,
    exportAll, importAll,
  };
})();
