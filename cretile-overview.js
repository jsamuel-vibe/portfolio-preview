(function () {
  'use strict';
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var videos = Array.from(document.querySelectorAll('.wa-case video'));
  var manuallyPaused = new WeakSet();

  // Native controls remain in HTML as the no-JavaScript fallback.
  videos.forEach(function (video, index) {
    var player = document.createElement('div');
    player.className = 'wa-video-player';
    video.parentNode.insertBefore(player, video);
    player.appendChild(video);
    if (!video.id) video.id = 'wa-video-' + (index + 1);
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'wa-video-toggle';
    button.setAttribute('aria-controls', video.id);
    button.innerHTML = '<span class="wa-video-icon" aria-hidden="true"></span>';
    player.appendChild(button);
    function syncPlayback() {
      var playing = !video.paused && !video.ended;
      player.dataset.playing = String(playing);
      button.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    }
    button.addEventListener('click', function () {
      if (video.paused || video.ended) {
        manuallyPaused.delete(video);
        video.play().catch(syncPlayback);
      } else {
        manuallyPaused.add(video);
        video.pause();
      }
    });
    ['play', 'pause', 'ended', 'error'].forEach(function (event) {
      video.addEventListener(event, syncPlayback);
    });
    video.controls = false;
    video.autoplay = false;
    video.tabIndex = -1;
    syncPlayback();
  });

  // Old shared links still reach the corresponding section on the full page.
  if (document.body.classList.contains('wa-overview')) {
    var destinations = {
      'design-story': 'story', scenarios: 'design-process', strategy: 'why',
      audience: 'audience', launch: 'shipped', 'reply-state': 'shipped',
      analytics: 'shipped', 'follow-up': 'automation', product: 'shipped',
      direction: 'next', takeaway: 'reflection', built: 'audience', goal: 'scope'
    };
    function followLegacyLink() {
      var id;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { return; }
      if (!Object.prototype.hasOwnProperty.call(destinations, id)) return;
      var destination = new URL('cretile-case-study.html', window.location.href);
      destination.hash = destinations[id];
      window.location.replace(destination.href);
    }
    followLegacyLink();
    window.addEventListener('hashchange', followLegacyLink);
  }

  document.querySelectorAll('[data-product-preview]').forEach(function (gallery) {
    var tabs = Array.from(gallery.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (tab) { return document.getElementById(tab.getAttribute('aria-controls')); });
    if (panels.some(function (panel) { return !panel; })) return;

    function select(index, focus) {
      tabs.forEach(function (tab, i) {
        var active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
        panels[i].querySelectorAll('video').forEach(function (video) {
          if (!active || reducedMotion || manuallyPaused.has(video)) video.pause();
          else video.play().catch(function () {});
        });
      });
      if (focus) tabs[index].focus();
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { select(index, false); });
      tab.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });
    gallery.classList.add('is-enhanced');
    select(0, false);
  });

  if (reducedMotion) {
    videos.forEach(function (video) {
      video.pause();
    });
  } else if ('IntersectionObserver' in window) {
    var playback = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        var panel = video.closest('[role="tabpanel"]');
        if (entry.isIntersecting && (!panel || !panel.hidden) && !manuallyPaused.has(video)) video.play().catch(function () {});
        else video.pause();
      });
    }, { threshold: .2 });
    videos.forEach(function (video) { playback.observe(video); });
  }

})();
