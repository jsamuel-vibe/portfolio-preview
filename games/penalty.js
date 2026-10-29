// Penalty shootout for the footer game stage. Draws the scene on a canvas from behind the striker;
// penalty-rules.js decides where the keeper dives and whether a shot scores.
(function () {
  var Rules = window.PenaltyRules;
  var RUNUP = 400, FLIGHT = 500, RESULT = 1000;
  var SIDE = { left: -1, centre: 0, right: 1 };
  var C = {
    sky: '#F6EEDF', stand: '#3E4A5C', hedge: '#4F8A3C',
    grass: '#7DB956', grassAlt: '#72AD4C', line: '#FFFFFF',
    keeper: '#F2683C', gloves: '#FFE14D', kit: '#1F2A44',
    striker: '#2F5BD3', skin: '#E0A37A', hair: '#2B1D14', ink: '#111111',
    hit: '#7DDC6A', missed: '#FF6B5A'
  };
  var CROWD = ['#F2683C', '#FFE14D', '#FFFFFF', '#2F5BD3', '#E86A92'];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  GameStage.register('penalty', function (container) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var card = document.createElement('div');
    card.className = 'penalty-card';
    card.hidden = true;
    card.setAttribute('aria-live', 'polite');
    var score = document.createElement('p');
    score.className = 'penalty-score';
    var again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn btn-primary btn-sm';
    again.textContent = 'Play again';
    card.append(score, again);
    container.append(canvas, card);

    var W = 0, H = 0, DPR = 1, L = null;
    var mode = 'idle', phase = 'ready', t = 0, clock = 0;
    var shot = null, results = [], history = [];
    var raf = 0, last = 0, running = false, wasRunning = false;

    // Scene geometry, all derived from the goal size so it scales to any stage.
    function layout() {
      var gw = Math.min(W * (W < 560 ? 0.86 : 0.6), H * 1.2);
      var gh = gw / 3;
      var gy = H * 0.58;
      var hz = gy - gh * 0.35;
      var dot = Math.max(2.5, gh * 0.04);
      var crowd = [], seed = 7;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (var row = 0; row < 3; row++) {
        for (var x = dot; x < W; x += dot * 2.8) {
          crowd.push({ x: x + rnd() * dot, y: hz - gh * (0.7 + row * 0.2), c: CROWD[Math.floor(rnd() * CROWD.length)] });
        }
      }
      return {
        gw: gw, gh: gh, gx: (W - gw) / 2, gy: gy, hz: hz, standTop: hz - gh * 1.25,
        bx: W / 2, by: gy + (H - gy) * 0.62, r0: gw * 0.028, r1: gw * 0.016,
        dot: dot, crowd: crowd
      };
    }

    function toScreen(target) {
      return { x: L.gx + target.x * L.gw, y: L.gy - target.y * L.gh };
    }

    function circle(x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function rrect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
    }

    // ---- State ----

    function setPhase(p) { phase = p; t = 0; }

    function reset() {
      shot = null;
      results = [];
      history = [];
      card.hidden = true;
      setPhase('ready');
    }

    // The keeper reads the aim (history); the ball goes where it actually lands.
    function shoot(aim) {
      var dive = Rules.pickDive(history, Math.random);
      var target = Rules.scatter(aim, Math.random);
      shot = { target: target, dive: dive, outcome: Rules.resolveShot(target, dive) };
      history.push(aim);
      setPhase('runup');
    }

    function finish() {
      shot = null;
      setPhase('done');
      score.textContent = Rules.scoreLine(results);
      card.hidden = false;
      again.focus({ preventScroll: true });
      halt();
      draw();
    }

    function update(dt) {
      t += dt;
      if (phase === 'runup' && t >= RUNUP) {
        setPhase('flight');
      } else if (phase === 'flight' && t >= FLIGHT) {
        if (mode === 'play') results.push(shot.outcome);
        setPhase('result');
      } else if (phase === 'result' && t >= RESULT) {
        if (mode === 'play' && results.length === Rules.SHOTS) finish();
        else { shot = null; setPhase('ready'); }
      }
    }

    // ---- Poses ----

    function diveProgress() {
      if (phase === 'flight') return ease(clamp01(t / (FLIGHT * 0.9)));
      return phase === 'result' ? 1 : 0;
    }

    function keeperPose(p) {
      var side = shot ? SIDE[shot.dive] : 0;
      var bob = p ? 0 : Math.abs(Math.sin(clock * 0.006)) * L.gh * 0.04;
      return {
        x: L.gx + (0.5 + side * 0.1 * p) * L.gw,
        y: L.gy - bob - (side ? Math.sin(p * Math.PI * 0.6) : p * 0.5) * L.gh * 0.24,
        angle: side * p * 1.15,
        reach: p > 0
      };
    }

    // Where the gloves are; a saved ball ends up here.
    function handPoint(k) {
      var d = L.gh * 0.62 * 1.15;
      return { x: k.x + d * Math.sin(k.angle), y: k.y - d * Math.cos(k.angle) };
    }

    function strikerPose() {
      var rest = { x: L.bx - L.gw * 0.16, y: L.by + (H - L.by) * 0.4 };
      var kick = { x: L.bx - L.gw * 0.07, y: L.by + (H - L.by) * 0.15 };
      var p = phase === 'runup' ? ease(clamp01(t / RUNUP)) : phase === 'flight' || phase === 'result' ? 1 : 0;
      return {
        x: lerp(rest.x, kick.x, p),
        y: lerp(rest.y, kick.y, p),
        running: phase === 'runup',
        kicked: phase === 'flight' || phase === 'result'
      };
    }

    function ballState(rp) {
      var b = { x: L.bx, y: L.by, r: L.r0, alpha: 1, ground: L.by };
      if (!shot || (phase !== 'flight' && phase !== 'result')) return b;
      var q = phase === 'flight' ? clamp01(t / FLIGHT) : 1;
      var end = shot.outcome === 'save' ? handPoint(keeperPose(1)) : toScreen(shot.target);
      var cx = (L.bx + end.x) / 2 + (shot.target.x - 0.5) * L.gw * 0.15;
      var cy = Math.min(L.by, end.y) - L.gh * 0.2;
      var u = 1 - q;
      b.x = u * u * L.bx + 2 * u * q * cx + q * q * end.x;
      b.y = u * u * L.by + 2 * u * q * cy + q * q * end.y;
      b.r = lerp(L.r0, L.r1, q);
      b.ground = lerp(L.by, L.gy, q);
      if (shot.outcome === 'goal') b.y = lerp(b.y, L.gy - L.r1, ease(rp));
      if (shot.outcome === 'miss') {
        var wide = shot.target.x < 0 ? -1 : shot.target.x > 1 ? 1 : 0;
        b.x += wide * rp * L.gw * 0.3;
        b.y -= (wide ? 0 : L.gh * 0.4) * rp;
        b.alpha = 1 - rp;
      }
      return b;
    }

    // ---- Drawing ----

    function drawPitch() {
      var g = L, i, x;
      ctx.fillStyle = C.sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.stand;
      ctx.fillRect(0, g.standTop, W, g.hz - g.standTop);
      g.crowd.forEach(function (p) { ctx.fillStyle = p.c; circle(p.x, p.y, g.dot); });
      ctx.fillStyle = C.hedge;
      var r = g.gh * 0.16;
      for (x = 0; x < W + r; x += r * 1.5) circle(x, g.hz - r * 0.4, r);
      for (i = 0; i < 7; i++) {
        var y0 = g.hz + (H - g.hz) * Math.pow(i / 7, 1.5);
        var y1 = g.hz + (H - g.hz) * Math.pow((i + 1) / 7, 1.5);
        ctx.fillStyle = i % 2 ? C.grassAlt : C.grass;
        ctx.fillRect(0, y0, W, y1 - y0 + 1);
      }
      var y6 = g.gy + (H - g.gy) * 0.16, yb = g.gy + (H - g.gy) * 0.8;
      ctx.strokeStyle = 'rgba(255, 255, 255, .85)';
      ctx.lineWidth = Math.max(1.5, g.gw * 0.006);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, g.gy); ctx.lineTo(W, g.gy);
      ctx.moveTo(g.gx - g.gw * 0.22, g.gy); ctx.lineTo(g.gx - g.gw * 0.3, y6);
      ctx.lineTo(g.gx + g.gw * 1.3, y6); ctx.lineTo(g.gx + g.gw * 1.22, g.gy);
      ctx.moveTo(g.gx - g.gw * 0.75, g.gy); ctx.lineTo(g.gx - g.gw * 1.1, yb);
      ctx.lineTo(g.gx + g.gw * 2.1, yb); ctx.lineTo(g.gx + g.gw * 1.75, g.gy);
      ctx.stroke();
      ctx.fillStyle = C.line;
      ctx.beginPath();
      ctx.ellipse(g.bx, g.by + g.r0 * 0.8, g.r0 * 0.5, g.r0 * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // The net mesh is pulled toward the ball when a goal goes in.
    function drawGoal(dent) {
      var g = L, top = g.gy - g.gh, cols = 24, rows = 8, i, j;
      function mesh(at, steps) {
        for (var k = 0; k <= steps; k++) {
          var p = at(k / steps);
          if (dent) {
            var dx = dent.x - p[0], dy = dent.y - p[1];
            var f = dent.k * Math.exp(-(dx * dx + dy * dy) / (g.gh * g.gh * 0.08));
            p = [p[0] + dx * f, p[1] + dy * f];
          }
          if (k) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
        }
      }
      ctx.fillStyle = 'rgba(255, 255, 255, .14)';
      ctx.fillRect(g.gx, top, g.gw, g.gh);
      ctx.strokeStyle = 'rgba(255, 255, 255, .5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (i = 0; i <= cols; i++) mesh(function (s) { return [g.gx + g.gw * i / cols, top + g.gh * s]; }, rows);
      for (j = 0; j <= rows; j++) mesh(function (s) { return [g.gx + g.gw * s, top + g.gh * j / rows]; }, cols);
      ctx.stroke();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = Math.max(3, g.gw * 0.012);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(g.gx, g.gy); ctx.lineTo(g.gx, top);
      ctx.lineTo(g.gx + g.gw, top); ctx.lineTo(g.gx + g.gw, g.gy);
      ctx.stroke();
    }

    function drawKeeper(k) {
      var u = L.gh * 0.62;
      var hx = k.reach ? 0.1 * u : 0.36 * u, hy = k.reach ? -1.15 * u : -0.5 * u;
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.angle);
      ctx.fillStyle = C.kit;
      ctx.fillRect(-0.15 * u, -0.38 * u, 0.1 * u, 0.38 * u);
      ctx.fillRect(0.05 * u, -0.38 * u, 0.1 * u, 0.38 * u);
      rrect(-0.18 * u, -0.52 * u, 0.36 * u, 0.18 * u, 0.04 * u);
      ctx.strokeStyle = C.keeper;
      ctx.lineWidth = 0.1 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-0.16 * u, -0.8 * u); ctx.lineTo(-hx, hy);
      ctx.moveTo(0.16 * u, -0.8 * u); ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = C.keeper;
      rrect(-0.2 * u, -0.88 * u, 0.4 * u, 0.4 * u, 0.1 * u);
      ctx.fillStyle = C.gloves;
      circle(-hx, hy, 0.075 * u);
      circle(hx, hy, 0.075 * u);
      ctx.fillStyle = C.skin;
      circle(0, -1.0 * u, 0.12 * u);
      ctx.fillStyle = C.hair;
      ctx.beginPath();
      ctx.arc(0, -1.0 * u, 0.12 * u, Math.PI, 0);
      ctx.fill();
      ctx.restore();
    }

    // Seen from behind: back of the head, number on the shirt.
    function drawStriker(s) {
      var u = L.gh * 0.7, swing = s.running ? Math.sin(clock * 0.03) * 0.35 : 0;
      function leg(x, a) {
        ctx.save();
        ctx.translate(x * u, -0.38 * u);
        ctx.rotate(a);
        ctx.fillRect(-0.05 * u, 0, 0.1 * u, 0.3 * u);
        ctx.fillStyle = C.striker;
        ctx.fillRect(-0.05 * u, 0.22 * u, 0.1 * u, 0.16 * u);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = C.skin;
      leg(-0.09, swing);
      leg(0.09, s.kicked ? -0.9 : -swing);
      ctx.fillStyle = '#FFFFFF';
      rrect(-0.19 * u, -0.54 * u, 0.38 * u, 0.2 * u, 0.05 * u);
      ctx.strokeStyle = C.striker;
      ctx.lineWidth = 0.09 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-0.17 * u, -0.84 * u); ctx.lineTo(-0.3 * u, (-0.56 + swing * 0.1) * u);
      ctx.moveTo(0.17 * u, -0.84 * u); ctx.lineTo(0.3 * u, (-0.56 - swing * 0.1) * u);
      ctx.stroke();
      ctx.fillStyle = C.striker;
      rrect(-0.21 * u, -0.92 * u, 0.42 * u, 0.42 * u, 0.1 * u);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 ' + Math.round(0.16 * u) + 'px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('10', 0, -0.7 * u);
      ctx.fillStyle = C.hair;
      circle(0, -1.04 * u, 0.13 * u);
      ctx.restore();
    }

    function drawBall(b) {
      ctx.globalAlpha = b.alpha;
      ctx.fillStyle = 'rgba(17, 17, 17, .18)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.ground + b.r * 0.6, b.r * 1.1, b.r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      circle(b.x, b.y, b.r);
      ctx.strokeStyle = 'rgba(17, 17, 17, .35)';
      ctx.lineWidth = Math.max(1, b.r * 0.12);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      circle(b.x, b.y, b.r * 0.35);
      ctx.globalAlpha = 1;
    }

    function drawHud() {
      var r = Math.max(6, L.gh * 0.05), gap = r * 3, w = gap * (Rules.SHOTS - 1);
      var cx = W / 2, cy = L.gy - L.gh - r * 3.2;
      ctx.fillStyle = 'rgba(17, 17, 17, .55)';
      rrect(cx - w / 2 - r * 2, cy - r * 1.8, w + r * 4, r * 3.6, r * 1.8);
      for (var i = 0; i < Rules.SHOTS; i++) {
        var x = cx - w / 2 + i * gap, res = results[i];
        if (res) {
          ctx.fillStyle = res === 'goal' ? C.hit : C.missed;
          circle(x, cy, r);
        } else {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, cy, r - 0.75, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    function drawResultText(rp) {
      var text = shot.outcome === 'goal' ? 'GOAL!' : shot.outcome === 'save' ? 'Saved' : 'Miss';
      var size = L.gh * 0.32 * (0.8 + 0.2 * ease(clamp01(rp * 4)));
      ctx.globalAlpha = 1 - clamp01((rp - 0.75) * 4);
      ctx.font = '600 ' + Math.round(size) + 'px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.12;
      ctx.strokeStyle = C.ink;
      ctx.strokeText(text, W / 2, L.gy - L.gh * 0.55);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, W / 2, L.gy - L.gh * 0.55);
      ctx.globalAlpha = 1;
    }

    function draw() {
      if (!L) return;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var rp = phase === 'result' ? clamp01(t / RESULT) : 0;
      var b = ballState(rp);
      var inNet = shot && phase === 'result' && shot.outcome === 'goal';
      drawPitch();
      drawGoal(inNet ? { x: b.x, y: b.y, k: 0.4 * (1 - rp) } : null);
      if (inNet) drawBall(b);
      drawKeeper(keeperPose(diveProgress()));
      if (!inNet) drawBall(b);
      drawStriker(strikerPose());
      if (mode === 'play') drawHud();
      if (phase === 'result') drawResultText(rp);
    }

    // ---- Loop ----

    function frame(now) {
      var dt = Math.min(50, now - last);
      last = now;
      clock += dt;
      update(dt);
      draw();
      if (running) raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function halt() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function play() {
      mode = 'play';
      reset();
      start();
    }

    // ---- Input ----

    function goalPoint(e) {
      var r = canvas.getBoundingClientRect();
      return Rules.toTarget((e.clientX - r.left - L.gx) / L.gw, (L.gy - (e.clientY - r.top)) / L.gh);
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (mode !== 'play' || phase !== 'ready' || !L) return;
      var target = goalPoint(e);
      if (target) shoot(target);
    });
    canvas.addEventListener('pointermove', function (e) {
      canvas.style.cursor = mode === 'play' && phase === 'ready' && L && goalPoint(e) ? 'crosshair' : '';
    });
    again.addEventListener('click', play);

    return {
      // Until someone clicks, the oval is one still frame: keeper set, ball on the spot.
      idle: function () {
        mode = 'idle';
        reset();
        draw();
      },
      play: play,
      resize: function (w, h) {
        if (!w || !h) return;
        W = w;
        H = h;
        DPR = window.devicePixelRatio || 1;
        canvas.width = Math.round(w * DPR);
        canvas.height = Math.round(h * DPR);
        L = layout();
        draw();
      },
      pause: function () {
        wasRunning = running;
        halt();
      },
      resume: function () {
        if (wasRunning) start();
      },
      stop: function () {
        halt();
        card.hidden = true;
      }
    };
  });
})();
