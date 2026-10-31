(function () {
  'use strict';
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var videos = Array.from(document.querySelectorAll('.wa-case video, .case-study video'));
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

  // Old shared links still reach the corresponding section, now on the same page.
  if (document.body.classList.contains('wa-overview')) {
    var destinations = {
      'design-story': 'why', story: 'why', scenarios: 'design-process', strategy: 'why',
      launch: 'shipped', 'reply-state': 'shipped',
      analytics: 'shipped', 'follow-up': 'automation', product: 'shipped',
      direction: 'next', takeaway: 'reflection', built: 'audience', goal: 'scope'
    };
    function followLegacyLink() {
      var id;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { return; }
      if (!Object.prototype.hasOwnProperty.call(destinations, id) || document.getElementById(id)) return;
      window.location.replace('#' + destinations[id]);
    }
    followLegacyLink();
    window.addEventListener('hashchange', followLegacyLink);
  }

  // Project-specific old anchors can follow a moved story without duplicating controls.
  if (document.body.dataset.storyPage) {
    var storyAnchors = (document.body.dataset.storyAnchors || '').split(/\s+/);
    function followProjectStoryLink() {
      var id;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { return; }
      if (!id || storyAnchors.indexOf(id) === -1) return;
      var destination = new URL(document.body.dataset.storyPage, window.location.href);
      destination.hash = id;
      window.location.replace(destination.href);
    }
    followProjectStoryLink();
    window.addEventListener('hashchange', followProjectStoryLink);
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
      if (autoAdvance) startView(index);
    }

    // Opt-in: each view plays its recording once, then hands over to the next, looping.
    // The active tab's line fills with the recording; pausing it pauses the cycle.
    var autoAdvance = gallery.hasAttribute('data-auto-advance') && !reducedMotion;

    // Opt-in: show each panel's caption inside its tab. Hidden from assistive tech,
    // which still reads the original caption beside the recording.
    if (gallery.hasAttribute('data-tab-captions')) {
      tabs.forEach(function (tab, index) {
        var caption = panels[index].querySelector('figcaption');
        if (!caption) return;
        var copy = document.createElement('span');
        copy.className = 'ss-tab-caption';
        copy.setAttribute('aria-hidden', 'true');
        copy.textContent = caption.textContent;
        tab.appendChild(copy);
      });
      gallery.classList.add('has-tab-captions');
    }
    var strip = gallery.querySelector('[role="tablist"]');
    var frame = 0;
    function startView(index) {
      var video = panels[index].querySelector('video');
      tabs.forEach(function (tab) { tab.style.setProperty('--progress', '0'); });
      if (video) video.currentTime = 0;
      // Keep the active tab visible when the phone strip scrolls sideways.
      var tabBox = tabs[index].getBoundingClientRect();
      var stripBox = strip.getBoundingClientRect();
      if (strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: strip.scrollLeft + tabBox.left - stripBox.left - (strip.clientWidth - tabBox.width) / 2, behavior: 'smooth' });
    }
    function trackProgress() {
      cancelAnimationFrame(frame);
      var index = tabs.findIndex(function (tab) { return tab.getAttribute('aria-selected') === 'true'; });
      var video = panels[index] && panels[index].querySelector('video');
      if (!video || !video.duration) return;
      tabs[index].style.setProperty('--progress', String(video.currentTime / video.duration));
      if (!video.paused && !video.ended) frame = requestAnimationFrame(trackProgress);
    }
    if (autoAdvance) {
      gallery.classList.add('is-auto');
      panels.forEach(function (panel, index) {
        var video = panel.querySelector('video');
        if (!video) return;
        video.loop = false;
        video.addEventListener('play', trackProgress);
        video.addEventListener('ended', function () {
          if (!panel.hidden) select((index + 1) % tabs.length, false);
        });
      });
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { select(index, false); });
      tab.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
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
