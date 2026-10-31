// Footer game stage: a strip on the page background where a game is always playable.
// Games call GameStage.register(name, factory); the stage owns size and lifecycle,
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
    // styles.css makes the stage position: relative. If a stale cached stylesheet lacks
    // the stage rules, stay hidden rather than spill an unstyled canvas over the footer.
    if (getComputedStyle(el).position !== 'relative') return;

    var screen = document.createElement('div');
    screen.className = 'game-screen';
    el.append(screen);

    var game = factory(screen);

    function size() {
      el.style.height = el.clientWidth / (window.innerWidth < 640 ? 1.6 : 2.4) + 'px';
    }
    window.addEventListener('resize', size);

    new ResizeObserver(function () {
      game.resize(screen.clientWidth, screen.clientHeight);
    }).observe(screen);
    // Only animate while the stage is on screen.
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) game.resume();
      else game.pause();
    }).observe(el);

    el.classList.add('is-ready');
    size();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.game-stage[data-game]').forEach(mount);
  });
})();
