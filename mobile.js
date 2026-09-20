/* Fullscreen must start from a user gesture; failure never blocks play. */
(() => {
  const buttons = [...document.querySelectorAll('[data-fullscreen]')];
  const status = document.getElementById('displayStatus');
  const root = document.documentElement;
  const browserButtons = [...document.querySelectorAll('[data-browser-play]')];
  let browserPlay = false;
  function fitBrowser() {
    root.style.setProperty('--browser-play-scale', String(Math.min(1, root.clientWidth / 844)));
  }
  function playInBrowser() {
    browserPlay = true;
    root.classList.add('browser-play');
    fitBrowser();
    for (const button of browserButtons) {
      button.textContent = '✓ Playing without fullscreen';
      button.setAttribute('aria-pressed', 'true');
    }
    say('Browser play enabled — no fullscreen needed. Turn your iPhone sideways for a larger court.');
  }
  browserButtons.forEach(button => button.addEventListener('click', playInBrowser));
  window.addEventListener('resize', fitBrowser);
  window.visualViewport?.addEventListener('resize', fitBrowser);
  fitBrowser();
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
          say('Fullscreen is unavailable here. Tap “Using iPhone? Play without fullscreen”, or turn your phone sideways and play normally.');
          return;
        }
        await request.call(root);
        await landscape();
      }
    } catch {
      say(browserPlay ? 'Continue playing in browser mode — fullscreen is optional.' : 'Fullscreen was unavailable. Tap “Using iPhone? Play without fullscreen” to continue.');
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
