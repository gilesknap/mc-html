/* Progressive enhancement for the landing-page clips. Posters and game links
 * remain usable without JavaScript, video decoding, or autoplay permission. */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const previews = [...document.querySelectorAll('[data-game-preview]')].map(container => {
    const video = container.querySelector('video');
    const button = container.querySelector('button');
    const state = { video, button, visible: false, userPaused: false, manualPlay: false, failed: false };
    const label = () => {
      const playing = !video.paused;
      button.textContent = playing ? 'Pause' : 'Play clip';
      button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${container.dataset.gamePreview} gameplay preview`);
    };
    const update = () => {
      const allowed = (!reducedMotion.matches && !connection?.saveData) || state.manualPlay;
      if (!state.failed && state.visible && !document.hidden && !state.userPaused && allowed) {
        if (!video.getAttribute('src')) video.src = video.dataset.src;
        video.play().catch(label); // Autoplay refusal leaves the explicit play control.
      } else video.pause();
      label();
    };
    button.hidden = false;
    button.addEventListener('click', () => {
      if (video.paused) { state.manualPlay = true; state.userPaused = false; }
      else { state.manualPlay = false; state.userPaused = true; }
      update();
    });
    video.addEventListener('loadeddata', () => video.classList.add('ready'));
    video.addEventListener('play', label); video.addEventListener('pause', label);
    video.addEventListener('error', () => { state.failed = true; video.classList.remove('ready'); button.hidden = true; });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => { state.visible = entries[0].isIntersecting; update(); }, { threshold: 0.1 });
      observer.observe(container);
    } else { state.visible = true; update(); }
    return { state, update };
  });
  document.addEventListener('visibilitychange', () => previews.forEach(p => p.update()));
  reducedMotion.addEventListener('change', () => {
    for (const p of previews) { if (reducedMotion.matches) p.state.manualPlay = false; p.update(); }
  });
  connection?.addEventListener('change', () => previews.forEach(p => p.update()));
})();
