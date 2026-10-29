// Penalty shootout rules: the keeper's dive and whether a shot scores. No DOM, so tests can run it in Node.
// Coordinates are normalised to the goal mouth: x 0 = left post, 1 = right post; y 0 = ground, 1 = crossbar.
(function (root) {
  var SHOTS = 5;
  var MARGIN = 0.15;
  var WOBBLE = 0.06;
  var DIVE_X = { left: 0.15, centre: 0.5, right: 0.85 };
  var REACH = { y: 0.4, rx: 0.2, ry: 0.5 };
  var LINES = ['Try another corner', "The keeper's having a day", 'Unlucky', 'Not bad', 'Nice finish', 'Perfect'];

  function sideOf(x) {
    return x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : 'centre';
  }

  // A click on the goal, or null if it's too far outside to count as a shot.
  function toTarget(x, y) {
    if (x < -MARGIN || x > 1 + MARGIN || y < -MARGIN || y > 1 + MARGIN) return null;
    return { x: x, y: Math.max(0, y) };
  }

  // Where the ball actually goes: a little off the aim, so shots tight to the frame can go wide or over.
  function scatter(target, rand) {
    return {
      x: target.x + (rand() * 2 - 1) * WOBBLE,
      y: Math.max(0, target.y + (rand() * 2 - 1) * WOBBLE)
    };
  }

  // The keeper commits before seeing the ball, leaning toward the side used most this round.
  function pickDive(history, rand) {
    var w = { left: 0.4, centre: 0.2, right: 0.4 };
    history.forEach(function (t) {
      var side = sideOf(t.x);
      if (side !== 'centre') w[side] += 0.1;
    });
    var r = rand() * (w.left + w.centre + w.right);
    if (r < w.left) return 'left';
    if (r < w.left + w.centre) return 'centre';
    return 'right';
  }

  // Outside the frame is a miss; inside the keeper's reach (an ellipse around the dive) is a save.
  function resolveShot(target, dive) {
    if (target.x < 0 || target.x > 1 || target.y > 1) return 'miss';
    var dx = (target.x - DIVE_X[dive]) / REACH.rx;
    var dy = (target.y - REACH.y) / REACH.ry;
    return dx * dx + dy * dy <= 1 ? 'save' : 'goal';
  }

  function scoreLine(results) {
    var goals = results.filter(function (r) { return r === 'goal'; }).length;
    return goals + ' / ' + SHOTS + ': ' + LINES[goals];
  }

  root.PenaltyRules = {
    SHOTS: SHOTS,
    toTarget: toTarget,
    scatter: scatter,
    pickDive: pickDive,
    resolveShot: resolveShot,
    scoreLine: scoreLine
  };
})(this);
