// app.js — small hash-free router + shared utilities.
const App = (() => {
  const views = {
    dashboard: DashboardView,
    upload: UploadView,
    review: ReviewView,
    puzzles: PuzzlesView,
    weaknesses: WeaknessesView,
    settings: SettingsView,
  };

  const root = document.getElementById('view-root');
  let toastTimer = null;

  function goto(name, params) {
    if (!views[name]) name = 'dashboard';
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
    try {
      views[name].render(root, params || {});
    } catch (e) {
      console.error('View render error', e);
      root.innerHTML = `<div class="panel"><h2 class="section-title">Something went wrong</h2><p style="color:var(--ivory-dim);font-size:13px;">${e.message}</p></div>`;
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function init() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => goto(tab.dataset.view));
    });
    const settings = Storage.getSettings();
    if (!settings.apiKey) {
      goto('settings');
      toast('Add your Anthropic API key to get started.');
    } else {
      goto('dashboard');
    }
  }

  return { goto, toast, init };
})();

document.addEventListener('DOMContentLoaded', App.init);
