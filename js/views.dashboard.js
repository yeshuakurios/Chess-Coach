// views.dashboard.js
const DashboardView = (() => {
  function render(root) {
    const profile = Storage.getProfile();
    const games = Storage.getGames();
    const puzzles = Storage.getPuzzles();
    const topWeakness = Storage.getTopWeakness();
    const need = Storage.xpForNextLevel(profile.level);
    const xpPct = Math.min(100, Math.round((profile.xp / need) * 100));

    const categoryLabel = (cat) => (cat || '').replace(/_/g, ' ');

    root.innerHTML = `
      <h1 class="page-title">Dashboard</h1>
      <p class="page-sub">Your standing, at a glance.</p>

      ${topWeakness ? `
      <div class="callout">
        <div class="glyph">♟</div>
        <div>
          <h3>Work on this before your next game</h3>
          <p><strong style="color:var(--ivory)">${categoryLabel(topWeakness.category)}</strong> — showed up ${topWeakness.count} time${topWeakness.count === 1 ? '' : 's'} across your recent games. That's your highest-leverage fix right now.</p>
        </div>
      </div>` : `
      <div class="empty-state panel">
        <div class="glyph">♟</div>
        <p>Upload your first game to get a personalized weakness callout here.</p>
      </div>`}

      <div class="panel" style="margin-top:16px;">
        <h2 class="section-title">Average game rating by time control</h2>
        <p style="font-size:12px;color:var(--ivory-dim);margin-top:-8px;">Estimated from move quality in each reviewed game, not self-reported — so bullet and rapid can (and usually should) look different.</p>
        <div class="stat-row">
          ${Storage.TIME_CONTROLS.map(tc => {
            const avg = Storage.getAverageElo(tc);
            const trend = Storage.getEloTrend(tc);
            const count = (profile.eloByTimeControl[tc] || []).length;
            return `
              <div class="stat-card">
                <div class="stat-label">${tc}</div>
                <div class="stat-value" style="font-size:26px;">${avg !== null ? avg : '—'}</div>
                <div class="stat-delta ${trend > 0 ? 'up' : trend < 0 ? 'down' : ''}">
                  ${count === 0 ? 'no games yet' : count + ' game' + (count === 1 ? '' : 's') + (trend ? ` · ${trend > 0 ? '+' : ''}${trend} trend` : '')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="panel" style="margin-top:16px;">
        <div class="stat-row">
          <div class="stat-card">
            <div class="stat-label">Puzzle Elo</div>
            <div class="stat-value">${profile.puzzleElo}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Level ${profile.level}</div>
            <div class="xp-wrap">
              <div class="xp-track"><div class="xp-fill" style="width:${xpPct}%"></div></div>
              <div class="xp-label"><span>${profile.xp} XP</span><span>${need} XP to level ${profile.level + 1}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2" style="margin-top:16px;">
        <div class="panel">
          <h2 class="section-title">Recent games</h2>
          ${games.length === 0 ? '<p style="color:var(--ivory-dim);font-size:13px;">No games yet.</p>' :
            games.slice(0, 5).map(g => `
              <div class="list-item">
                <div>
                  <div>${g.white || 'White'} vs ${g.black || 'Black'}</div>
                  <div class="meta">${new Date(g.date).toLocaleDateString()} · ${g.timeControl || 'rapid'} · ${g.result || '*'}${typeof g.review?.estimatedElo === 'number' ? ` · est. ${g.review.estimatedElo}` : ''}</div>
                </div>
                <button class="btn small" data-open-review="${g.id}">Review</button>
              </div>
            `).join('')}
        </div>
        <div class="panel">
          <h2 class="section-title">Puzzle activity</h2>
          <div class="stat-row" style="gap:10px;">
            <div class="stat-card" style="min-width:0;">
              <div class="stat-label">Solved</div>
              <div class="stat-value" style="font-size:24px;">${profile.puzzlesSolved}</div>
            </div>
            <div class="stat-card" style="min-width:0;">
              <div class="stat-label">Missed</div>
              <div class="stat-value" style="font-size:24px;">${profile.puzzlesFailed}</div>
            </div>
            <div class="stat-card" style="min-width:0;">
              <div class="stat-label">Queue</div>
              <div class="stat-value" style="font-size:24px;">${puzzles.filter(p => !p.solved).length}</div>
            </div>
          </div>
          <div style="margin-top:14px;">
            <button class="btn solid" data-goto="puzzles">Solve puzzles</button>
          </div>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-open-review]').forEach(btn => {
      btn.addEventListener('click', () => App.goto('review', { gameId: btn.dataset.openReview }));
    });
    root.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => App.goto(btn.dataset.goto));
    });
  }
  return { render };
})();
