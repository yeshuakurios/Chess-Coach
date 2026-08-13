// views.settings.js
const SettingsView = (() => {
  function render(root) {
    const settings = Storage.getSettings();
    const profile = Storage.getProfile();

    root.innerHTML = `
      <h1 class="page-title">Settings</h1>
      <p class="page-sub">Everything here stays in this browser only.</p>

      <div class="panel">
        <h2 class="section-title">Anthropic API key</h2>
        <p style="font-size:13px;color:var(--ivory-dim);margin-top:-6px;">
          Used to write your game reviews. Stored only in this browser's local storage —
          never committed to the repo, never sent anywhere except directly to Anthropic's API.
        </p>
        <div class="field">
          <label class="field-label">API key</label>
          <input type="password" id="apiKeyInput" value="${settings.apiKey || ''}" placeholder="sk-ant-...">
        </div>
        <div class="field">
          <label class="field-label">Model</label>
          <input type="text" id="modelInput" value="${settings.model || 'claude-sonnet-5'}">
        </div>
        <div class="field">
          <label class="field-label">Your chess.com / lichess username</label>
          <input type="text" id="usernameInput" value="${settings.username || ''}" placeholder="e.g. bibleoverthinker">
        </div>
        <p style="font-size:13px;color:var(--ivory-dim);margin-top:-8px;">
          When you paste a full PGN export into New Game, this is matched against its White/Black tags to
          fill in your color, opponent, and the result automatically — no need to enter them by hand.
        </p>
        <button class="btn solid" id="saveSettingsBtn">Save</button>
        <span id="settingsStatus" style="font-size:13px;color:var(--sage);margin-left:10px;"></span>
      </div>

      <div class="panel">
        <h2 class="section-title">Live game ratings</h2>
        <p style="font-size:13px;color:var(--ivory-dim);margin-top:-6px;">
          These are estimated automatically from each reviewed game's move quality, per time control —
          there's nothing to set manually here. See the Dashboard for your current averages.
        </p>
      </div>

      <div class="panel">
        <h2 class="section-title">Data</h2>
        <p style="font-size:13px;color:var(--ivory-dim);margin-top:-6px;">Export a backup, or wipe everything and start over.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn ghost" id="exportBtn">Export JSON</button>
          <label class="btn ghost" style="cursor:pointer;">
            Import JSON
            <input type="file" id="importInput" accept="application/json" style="display:none;">
          </label>
          <button class="btn ghost" id="resetBtn" style="border-color:var(--brick);color:var(--brick);">Reset all data</button>
        </div>
      </div>
    `;

    root.querySelector('#saveSettingsBtn').addEventListener('click', () => {
      Storage.saveSettings({
        apiKey: root.querySelector('#apiKeyInput').value.trim(),
        model: root.querySelector('#modelInput').value.trim() || 'claude-sonnet-5',
        username: root.querySelector('#usernameInput').value.trim(),
      });
      root.querySelector('#settingsStatus').textContent = 'Saved.';
      setTimeout(() => { root.querySelector('#settingsStatus').textContent = ''; }, 2000);
    });

    root.querySelector('#exportBtn').addEventListener('click', () => {
      const data = Storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `chess-coach-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    });

    root.querySelector('#importInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Storage.importAll(data);
          App.toast('Import complete.');
          App.goto('dashboard');
        } catch (err) {
          App.toast('Invalid backup file.');
        }
      };
      reader.readAsText(file);
    });

    root.querySelector('#resetBtn').addEventListener('click', () => {
      if (confirm('This wipes all games, puzzles, and progress in this browser. Continue?')) {
        localStorage.removeItem('cc_games');
        localStorage.removeItem('cc_puzzles');
        localStorage.removeItem('cc_profile');
        App.toast('All data reset.');
        App.goto('dashboard');
      }
    });
  }
  return { render };
})();
