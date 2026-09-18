/* Fullscreen must start from a user gesture; failure never blocks play. */
(() => {
  const buttons = [...document.querySelectorAll('[data-fullscreen]')];
  const status = document.getElementById('displayStatus');
  const root = document.documentElement;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const fullscreenMode = window.matchMedia('(display-mode: fullscreen)');
  const active = () => document.fullscreenElement || document.webkitFullscreenElement;
  const installed = () => navigator.standalone || standalone.matches || fullscreenMode.matches;
  let busy = false;
  let timeout;
  function say(message) {
    clearTimeout(timeout);
    status.textContent = message;
    timeout = setTimeout(() => { status.textContent = ''; }, 8500);
  }
  function sync() {
    for (const button of buttons) {
      button.textContent = active() ? '⛶ Exit full screen' : installed() ? '⛶ App display' : '⛶ Full screen';
      button.setAttribute('aria-pressed', String(Boolean(active() || installed())));
      button.disabled = busy;
    }
  }
  async function landscape() {
    try {
      if (!screen.orientation?.lock) throw new Error('unavailable');
      await screen.orientation.lock('landscape');
    } catch {
      if (window.matchMedia('(orientation: portrait)').matches)
        say('Turn your phone sideways. If needed, disable rotation lock.');
    }
  }
  async function toggle() {
    if (busy) return;
    busy = true;
    sync();
    try {
      if (active()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        await exit.call(document);
      } else if (installed()) {
        say('Already in app display. Turn your phone sideways to play.');
        await landscape();
      } else {
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        if (!request) {
          say('Full screen is unavailable here. On iPhone: Safari → Share → Add to Home Screen. Then open the new icon and turn your phone sideways.');
          return;
        }
        await request.call(root);
        await landscape();
      }
    } catch {
      say('This browser could not enter full screen. You can still play sideways, or open the site from your Home Screen.');
    } finally {
      busy = false;
      sync();
    }
  }
  buttons.forEach(button => button.addEventListener('click', toggle));
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  standalone.addEventListener('change', sync);
  fullscreenMode.addEventListener('change', sync);
  sync();
})();
