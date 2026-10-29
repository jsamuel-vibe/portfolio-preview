// Footer game stage: an oval that plays a game's demo and expands in place to play it.
// Games call GameStage.register(name, factory); the stage owns shape, state, focus and lifecycle,
// and the game owns everything inside the container it's given.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var factories = {};

  window.GameStage = {
    reduceMotion: reduceMotion,
    register: function (name, factory) { factories[name] = factory; }
  };

  function mount(el) {
    var factory = factories[el.getAttribute('data-game')];
    if (!factory) return;

    var screen = document.createElement('div');
    screen.className = 'game-screen';
    var cta = document.createElement('span');
    cta.className = 'game-cta btn btn-secondary btn-sm';
    cta.setAttribute('aria-hidden', 'true');
    cta.textContent = el.getAttribute('data-label') || 'Play';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'game-close btn btn-secondary btn-round';
    close.setAttribute('aria-label', 'Close game');
    close.textContent = '×';
    el.append(screen, cta, close);

    var game = factory(screen);
    var open = false;

    function height(isOpen) {
      var w = el.clientWidth;
      var narrow = window.innerWidth < 640;
      if (!isOpen) return w / (narrow ? 1.6 : 2.4);
      return Math.min(w * (narrow ? 5 / 4 : 9 / 16), window.innerHeight * 0.8);
    }

    function size() { el.style.height = height(open) + 'px'; }

    // Collapsed, the whole oval is one button; expanded, clicks belong to the game.
    function asButton() {
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
    }

    function expand() {
      if (open) return;
      open = true;
      el.classList.add('is-open');
      el.setAttribute('role', 'group');
      el.removeAttribute('tabindex');
      size();
      // Centre the stage at its final height, not the height it's animating from.
      var top = el.getBoundingClientRect().top + window.scrollY - (window.innerHeight - height(true)) / 2;
      window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
      close.focus({ preventScroll: true });
      game.play();
    }

    function collapse() {
      if (!open) return;
      open = false;
      el.classList.remove('is-open');
      asButton();
      size();
      game.stop();
      game.idle();
      el.focus({ preventScroll: true });
    }

    el.addEventListener('click', expand);
    el.addEventListener('keydown', function (e) {
      if (!open && e.target === el && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        expand();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (open && e.key === 'Escape') collapse();
    });
    // Stop the click reaching the stage, which would open it again.
    close.addEventListener('click', function (e) {
      e.stopPropagation();
      collapse();
    });
    window.addEventListener('resize', size);

    new ResizeObserver(function () {
      game.resize(screen.clientWidth, screen.clientHeight);
    }).observe(screen);
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) game.resume();
      else game.pause();
    }).observe(el);

    el.classList.add('is-ready');
    asButton();
    size();
    game.idle();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.game-stage[data-game]').forEach(mount);
  });
})();
