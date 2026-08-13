// views.weaknesses.js
const WeaknessesView = (() => {
  function render(root) {
    const breakdown = Storage.getWeaknessBreakdown();
    const topWeakness = Storage.getTopWeakness();
    const maxCount = breakdown.length ? breakdown[0].count : 1;

    if (breakdown.length === 0) {
      root.innerHTML = `
        <h1 class="page-title">Weaknesses</h1>
        <div class="empty-state panel"><div class="glyph">♟</div><p>Upload and review games to build your weakness profile.</p></div>
      `;
      return;
    }

    root.innerHTML = `
      <h1 class="page-title">Weaknesses</h1>
      <p class="page-sub">Mistake categories across every reviewed game, most frequent first.</p>

      ${topWeakness ? `
      <div class="callout">
        <div class="glyph">♟</div>
        <div><h3>Priority: ${topWeakness.category.replace(/_/g,' ')}</h3>
        <p>Weighted toward your most recent games — this is what's costing you points right now.</p></div>
      </div>` : ''}

      <div class="panel" style="margin-top:16px;">
        <h2 class="section-title">By category</h2>
        ${breakdown.map(b => `
          <div class="bar-row">
            <div class="bar-label">${b.category.replace(/_/g,' ')}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round((b.count / maxCount) * 100)}%"></div></div>
            <div class="bar-count">${b.count}</div>
          </div>
        `).join('')}
      </div>

      <div class="panel" style="margin-top:16px;">
        <h2 class="section-title">All flagged moves</h2>
        ${Storage.getAllMistakes()
          .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))
          .slice(0, 30)
          .map(m => `
            <div class="list-item">
              <div>
                <span class="tag ${m.classification}">${m.classification}</span>
                <span style="margin-left:8px;font-family:var(--mono);font-size:13px;">${m.san}</span>
                <span style="margin-left:8px;font-size:12px;color:var(--ivory-dim);">${(m.category||'').replace(/_/g,' ')}</span>
              </div>
              <span class="meta">${new Date(m.gameDate).toLocaleDateString()}</span>
            </div>
          `).join('')}
      </div>
    `;
  }
  return { render };
})();
