// Site behaviour: "View all" toggles, back-to-top button, and the section rail on case studies.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scrollBehavior = reduceMotion ? 'auto' : 'smooth';

  // "View all" toggles. Extra items stay visible unless this script runs,
  // so the page never hides content it can't reveal again.
  document.querySelectorAll('[data-toggle-more]').forEach(function (btn) {
    var target = document.getElementById(btn.getAttribute('aria-controls'));
    if (!target) return;
    var showLabel = btn.textContent;
    target.hidden = true;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var open = target.hidden;
      target.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Show fewer' : showLabel;
      // Collapsing removes content above the button; keep it under the cursor.
      if (!open) btn.scrollIntoView({ block: 'center' });
    });
  });

  // Copy email: clipboard where allowed, otherwise select the address so it can be copied by hand.
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var label = btn.textContent;
    var timer;
    var done = function (text) {
      btn.textContent = text;
      clearTimeout(timer);
      timer = setTimeout(function () { btn.textContent = label; }, 2000);
    };
    btn.setAttribute('aria-live', 'polite');
    btn.addEventListener('click', function () {
      var value = btn.getAttribute('data-copy');
      var fallback = function () {
        var link = btn.parentNode.querySelector('a');
        if (link) {
          var range = document.createRange();
          range.selectNodeContents(link);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        done('Selected, copy it');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(function () { done('Copied'); }, fallback);
      } else {
        fallback();
      }
    });
  });

  // Back to top: appears once the reader is well into the page.
  var toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.className = 'to-top';
  toTop.setAttribute('aria-label', 'Back to top');
  toTop.innerHTML = '<span aria-hidden="true">↑</span>';
  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: scrollBehavior });
  });
  document.body.appendChild(toTop);

  // Section rail: one line per section, the current one highlighted,
  // hover shows the section's title and first line, click jumps there.
  var sections = [];
  var intro = document.querySelector('.project-intro h1');
  if (intro) {
    document.querySelectorAll('main section, main header').forEach(function (el) {
      var collapsedStory = el.closest('details:not([open])');
      if (collapsedStory) return;
      var heading = el === intro.closest('header') ? intro : el.querySelector(':scope > h2, :scope > div > h2, :scope > div > div > h2');
      if (!heading) return;
      var first = el.querySelector('.t-body');
      var text = first ? first.textContent.trim() : '';
      sections.push({
        el: el,
        heading: heading,
        title: el.tagName === 'HEADER' ? 'Overview' : heading.textContent.trim(),
        snippet: text.length > 120 ? text.slice(0, 117).trim() + '…' : text
      });
    });
  }

  if (sections.length > 2) {
    var rail = document.createElement('nav');
    rail.className = 'rail';
    rail.setAttribute('aria-label', 'Sections');
    var tip = document.createElement('div');
    tip.className = 'rail-tip';
    tip.setAttribute('aria-hidden', 'true');
    tip.innerHTML = '<strong></strong><span></span>';
    rail.appendChild(tip);

    sections.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rail-item';
      b.setAttribute('aria-label', s.title);
      b.innerHTML = '<span class="rail-line"></span>';
      b.addEventListener('click', function () {
        var story = s.heading.closest('details');
        if (story) story.open = true;
        s.heading.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
      });
      var show = function () {
        tip.firstChild.textContent = (i + 1) + '. ' + s.title;
        tip.lastChild.textContent = s.snippet;
        tip.style.top = (b.offsetTop + b.offsetHeight / 2) + 'px';
        rail.classList.add('show-tip');
      };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('mouseleave', function () { rail.classList.remove('show-tip'); });
      b.addEventListener('blur', function () { rail.classList.remove('show-tip'); });
      s.button = b;
      rail.appendChild(b);
    });
    document.body.appendChild(rail);
  }

  // Carousel: prev/next step one slide; the counter follows whatever slide is in view.
  document.querySelectorAll('[data-carousel]').forEach(function (car) {
    var track = car.querySelector('.carousel-track');
    var slides = [].slice.call(track.children);
    var prev = car.querySelector('[data-prev]');
    var next = car.querySelector('[data-next]');
    var count = car.querySelector('.carousel-count');
    var index = function () {
      var left = track.getBoundingClientRect().left;
      var best = 0, dist = Infinity;
      slides.forEach(function (s, i) {
        var d = Math.abs(s.getBoundingClientRect().left - left);
        if (d < dist) { dist = d; best = i; }
      });
      return best;
    };
    var update = function () {
      var i = index();
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      count.textContent = (atEnd ? slides.length : i + 1) + ' / ' + slides.length;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = atEnd;
    };
    var go = function (dir) {
      var i = Math.max(0, Math.min(slides.length - 1, index() + dir));
      track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: scrollBehavior });
    };
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    track.addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  // Every still image in a case study opens in the lightbox too, all in one group per page.
  // Links (Home cards, next-project previews) and videos are left alone.
  if (document.querySelector('.project-intro')) {
    document.querySelectorAll('main img.media, main img.media-strip').forEach(function (im) {
      if (im.closest('.zoomable, a')) return;
      var fig = im.closest('figure');
      var figcap = fig && fig.querySelector('figcaption');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zoomable';
      b.setAttribute('data-lightbox', 'page');
      b.setAttribute('data-caption', figcap ? figcap.textContent.trim() : im.alt);
      b.setAttribute('aria-label', 'Open image full screen: ' + im.alt);
      im.parentNode.insertBefore(b, im);
      b.appendChild(im);
    });
    // The versions carousel joins the page group so the viewer can step through everything.
    document.querySelectorAll('[data-lightbox="home-versions"]').forEach(function (b) {
      b.setAttribute('data-lightbox', 'page');
    });
  }

  // Lightbox: full-screen view for [data-lightbox] buttons, grouped by the attribute's value.
  var groups = {};
  document.querySelectorAll('[data-lightbox]').forEach(function (b) {
    var g = b.getAttribute('data-lightbox');
    (groups[g] = groups[g] || []).push(b);
  });
  if (Object.keys(groups).length && typeof HTMLDialogElement === 'function') {
    var lb = document.createElement('dialog');
    lb.className = 'lightbox';
    lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML =
      '<div class="lb-top"><span class="lb-count"></span>' +
      '<button class="lb-btn lb-close" type="button" aria-label="Close"><span aria-hidden="true">✕</span></button></div>' +
      '<div class="lb-stage"><button class="lb-btn lb-prev" type="button" aria-label="Previous"><span aria-hidden="true">←</span></button>' +
      '<img alt=""><button class="lb-btn lb-next" type="button" aria-label="Next"><span aria-hidden="true">→</span></button></div>' +
      '<p class="lb-caption"></p>';
    document.body.appendChild(lb);
    var img = lb.querySelector('img');
    var cap = lb.querySelector('.lb-caption');
    var cnt = lb.querySelector('.lb-count');
    var lbPrev = lb.querySelector('.lb-prev');
    var lbNext = lb.querySelector('.lb-next');
    var items = [], at = 0, opener = null;

    var show = function (i) {
      at = Math.max(0, Math.min(items.length - 1, i));
      var src = items[at].querySelector('img');
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      cap.textContent = items[at].getAttribute('data-caption') || '';
      cnt.textContent = (at + 1) + ' / ' + items.length;
      lbPrev.disabled = at === 0;
      lbNext.disabled = at === items.length - 1;
    };
    Object.keys(groups).forEach(function (g) {
      groups[g].forEach(function (b, i) {
        b.addEventListener('click', function () {
          items = groups[g]; opener = b;
          show(i);
          document.documentElement.style.overflow = 'hidden';
          lb.showModal();
          lbNext.disabled ? lb.querySelector('.lb-close').focus() : lbNext.focus();
        });
      });
    });
    lbPrev.addEventListener('click', function () { show(at - 1); });
    lbNext.addEventListener('click', function () { show(at + 1); });
    lb.querySelector('.lb-close').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-stage')) lb.close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); }
    });
    lb.addEventListener('close', function () {
      document.documentElement.style.overflow = '';
      if (opener) opener.focus({ preventScroll: true });
    });
    // Swipe left/right on touch screens.
    var startX = null;
    var stage = lb.querySelector('.lb-stage');
    stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') startX = e.clientX; });
    stage.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1));
    });
  }

  var ticking = false;
  function onScroll() {
    ticking = false;
    toTop.classList.toggle('is-visible', window.scrollY > 700);
    if (!sections.length || !sections[0].button) return;
    var line = window.innerHeight * 0.35;
    var current = 0;
    sections.forEach(function (s, i) {
      if (s.el.closest('details:not([open])')) return;
      if (s.heading.getBoundingClientRect().top <= line) current = i;
    });
    sections.forEach(function (s, i) {
      s.button.classList.toggle('is-active', i === current);
      if (i === current) s.button.setAttribute('aria-current', 'true');
      else s.button.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  document.querySelectorAll('details').forEach(function (details) {
    details.addEventListener('toggle', onScroll);
  });
  onScroll();
})();

// Exploration board: drafts fan out from the title the first time the board comes into view.
(function () {
  var board = document.querySelector('.ss-exploration-board');
  if (!board || !('IntersectionObserver' in window)) return;
  if (!matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)').matches) return;
  if (board.getBoundingClientRect().top < window.innerHeight * 0.8) return;
  board.classList.add('is-armed');
  var io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    board.getBoundingClientRect();
    board.classList.replace('is-armed', 'is-entering');
    setTimeout(function () { board.classList.remove('is-entering'); }, 2800);
  }, { threshold: 0.3 });
  io.observe(board);
})();
