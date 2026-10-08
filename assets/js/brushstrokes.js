/*
 * Generative brushstroke painter for the Artwork page.
 * Paints a landscape out of short strokes that follow a noise-driven flow field:
 * rising diagonal strokes in the sky, rolling horizontal strokes in the field,
 * after Van Gogh's "Snow-Covered Field with a Harrow" (1890).
 */
(function () {
  "use strict";

  var PALETTES = {
    harrow: {
      skyBase: ["#f1ecc4", "#e4e7c8"],
      sky: [["#f3ecbd", 4], ["#ece3a2", 3], ["#f7f2d6", 3], ["#dfe7c6", 2], ["#c9ded1", 2], ["#e8da8e", 1], ["#b9d6cc", 1]],
      skyHigh: [["#c6ddd2", 3], ["#d8e6d2", 2], ["#b3d1c8", 2], ["#eee8bc", 2]],
      fieldBase: ["#a5cbbf", "#86b6ab"],
      field: [["#8fc0b4", 5], ["#a7d0c4", 4], ["#7db0a5", 4], ["#b9dacd", 3], ["#6aa197", 2], ["#d3e6d9", 2], ["#e9ecd3", 1]],
      fieldFar: [["#b4d4c9", 4], ["#c6ddd1", 4], ["#a9cbc0", 3], ["#d6e5d6", 2], ["#e2e8cf", 1]],
      dark: [["#2f5e58", 3], ["#3f7a6f", 3], ["#22423f", 1]],
      bird: "#2b3a39",
      wall: ["#efe9cf", "#e6dfbf", "#f4efd9"],
      roof: ["#8a5a4a", "#3f7a6f", "#a0684f"]
    },
    starry: {
      skyBase: ["#2b4f8c", "#3c69a8"],
      sky: [["#2c5aa0", 4], ["#3f74bd", 3], ["#1f3d7a", 3], ["#6d98cf", 2], ["#9dbbe0", 1], ["#f2d15c", 1]],
      skyHigh: [["#1f3d7a", 3], ["#28497f", 3], ["#4a7cc4", 2], ["#f5dc7a", 1]],
      fieldBase: ["#2a3f5e", "#1d2c45"],
      field: [["#2e4a6b", 4], ["#3b5b7d", 3], ["#22344f", 3], ["#4c6f86", 2], ["#6b8a6a", 1]],
      fieldFar: [["#4c6f8f", 3], ["#5f81a0", 2], ["#3f6283", 2]],
      dark: [["#141f33", 3], ["#1b2a40", 2]],
      bird: "#f2d15c",
      wall: ["#d9c98a", "#e2d39a"],
      roof: ["#6b4a3a", "#1b2a40"]
    },
    wheat: {
      skyBase: ["#bcd6e4", "#d7e6ea"],
      sky: [["#a9cce3", 4], ["#cfe3ef", 3], ["#8fb9d6", 2], ["#e6eff0", 2], ["#f3e7b3", 1]],
      skyHigh: [["#8fb9d6", 3], ["#7aa7c9", 2], ["#a9cce3", 2]],
      fieldBase: ["#dfb44c", "#cf9a35"],
      field: [["#e3b94a", 5], ["#d29a2f", 3], ["#f0d27a", 3], ["#c7862a", 2], ["#b8a24a", 1], ["#f6e3a1", 1]],
      fieldFar: [["#efd38a", 3], ["#e9c86e", 3], ["#f4e2ad", 2]],
      dark: [["#6b5a2a", 2], ["#4f6b3a", 2]],
      bird: "#2b2b2b",
      wall: ["#f3ead0", "#ece0bb"],
      roof: ["#b0583a", "#8a4a32"]
    }
  };

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function makeNoise(seed) {
    function hash(ix, iy) {
      var h = Math.sin(ix * 127.1 + iy * 311.7 + seed * 0.137) * 43758.5453;
      return h - Math.floor(h);
    }
    return function (x, y) {
      var ix = Math.floor(x), iy = Math.floor(y);
      var fx = x - ix, fy = y - iy;
      var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      var a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  function pick(list, r) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i][1];
    var t = r() * total;
    for (i = 0; i < list.length; i++) {
      t -= list[i][1];
      if (t <= 0) return list[i][0];
    }
    return list[list.length - 1][0];
  }

  function buildStrokes(W, H, seed, pal) {
    var r = rng(seed), noise = makeNoise(seed);
    var strokes = [];

    // Horizon with a gentle hill, like the village mound in the painting.
    function horizon(x) {
      var t = x / W;
      var hill = Math.exp(-Math.pow((t - 0.55) / 0.16, 2)) * H * 0.035;
      return H * 0.40 + Math.sin(t * 3.1 + 1) * H * 0.008 + (noise(t * 5, 0.5) - 0.5) * H * 0.02 - hill;
    }

    function flowAngle(x, y, sky) {
      var n = noise(x / 140, y / 140) - 0.5;
      if (sky) return -1.12 + n * 0.9;
      return Math.sin(x / 70 + y / 28) * 0.22 + n * 0.8;
    }

    function clampSide(x, y, sky, pad) {
      var hz = horizon(x);
      return sky ? Math.min(y, hz - pad) : Math.max(y, hz + pad);
    }

    function stroke(x, y, sky, color, len, width, alpha) {
      var pad = width / 2 + 0.5;
      y = clampSide(x, y, sky, pad);
      var pts = [[x, y]], steps = sky ? 4 : 6, seg = len / steps;
      for (var s = 0; s < steps; s++) {
        var a = flowAngle(x, y, sky);
        x += Math.cos(a) * seg; y = clampSide(x, y + Math.sin(a) * seg, sky, pad);
        pts.push([x, y]);
      }
      strokes.push({ pts: pts, color: color, width: width, alpha: alpha });
    }

    var scale = Math.max(0.6, Math.min(1.4, Math.sqrt(W * H) / 900));
    var count = Math.round((W * H) / (38 * scale));

    // Aerial perspective: near the horizon strokes are small, pale and soft;
    // towards the bottom they grow longer, wider and more contrasted.
    for (var i = 0; i < count; i++) {
      var x = r() * (W + 40) - 20, y = r() * (H + 40) - 20;
      var hz = horizon(x), sky = y < hz;
      var color, len, width, alpha;
      if (sky) {
        var high = (hz - y) / hz;
        color = pick(high > 0.55 && r() < 0.6 ? pal.skyHigh : pal.sky, r);
        var low = 1 - Math.min(1, high * 2.5);            // 1 right above the horizon
        len = (10 + r() * 18) * scale * (1 - low * 0.45); width = (1.4 + r() * 2.4) * scale * (1 - low * 0.35);
        alpha = 0.55 + r() * 0.4;
      } else {
        var depth = Math.max(0, Math.min(1, (y - hz) / (H - hz)));
        var d = Math.pow(depth, 0.8);
        var far = depth < 0.22 && r() < 0.75 - depth * 2.5;
        color = r() < 0.01 + depth * 0.07 ? pick(pal.dark, r) : pick(far ? (pal.fieldFar || pal.field) : pal.field, r);
        len = (8 + r() * 30) * scale * (0.3 + d * 1.5);
        width = (1.1 + r() * 2.6) * scale * (0.4 + d * 1.2);
        alpha = (0.45 + r() * 0.4) * (0.75 + d * 0.3);
      }
      stroke(x, y, sky, color, len, width, alpha);
    }

    // Dark furrow rows, crowding together towards the horizon.
    var rows = 10 + Math.floor(r() * 4);
    for (var fr = 0; fr < rows; fr++) {
      var frac = Math.pow((fr + 0.5 + r() * 0.4) / rows, 1.9);
      var fx = -20;
      while (fx < W + 20) {
        var hzx = horizon(fx), fd = 0.3 + frac * 1.4;
        var flen = (25 + r() * 60) * scale * fd;
        var fy = hzx + 5 * scale + (H - hzx) * frac + (r() - 0.5) * 6 * scale * fd;
        if (r() < 0.5) stroke(fx, fy, false, pick(pal.dark, r), flen, (0.9 + r() * 1.5) * scale * fd, (0.35 + r() * 0.3) * (0.6 + frac * 0.5));
        fx += flen + r() * 50 * scale * fd;
      }
    }

    // A few distant trees on the horizon: round bushes of different heights and pointed cypresses.
    function bush(cx, rx, ry) {
      var base = horizon(cx) + 1.5 * scale;
      for (var k = 0; k < 40; k++) {
        var ang = Math.PI + r() * Math.PI, rad = Math.sqrt(r());
        var px = cx + Math.cos(ang) * rx * rad, py = base + Math.sin(ang) * ry * rad;
        strokes.push({ pts: [[px, py], [px + (r() - 0.5) * 3 * scale, py - r() * 2.5 * scale]], color: r() < 0.75 ? pick(pal.dark, r) : pick(pal.field, r), width: (1.4 + r() * 1.4) * scale, alpha: 0.8 });
      }
    }
    function cypress(cx, h, w) {
      var base = horizon(cx) + 1.5 * scale;
      strokes.push({ pts: [[cx, base], [cx + (r() - 0.5) * 1.5, base - h * 0.5], [cx + (r() - 0.5) * 1.5, base - h]], color: pal.dark[0][0], width: w * 0.45, alpha: 0.85 });
      for (var k = 0; k < 34; k++) {
        var t = r(), y = base - t * h, half = w * 0.5 * Math.pow(1 - t, 0.7);
        var px = cx + (r() - 0.5) * 2 * half;
        strokes.push({ pts: [[px, y + 2 * scale], [px + (r() - 0.5) * 1.2 * scale, y - 3 * scale]], color: pick(pal.dark, r), width: (1.1 + r()) * scale, alpha: 0.8 });
      }
    }
    var jitter = function () { return (r() - 0.5) * 0.03; };
    bush(W * (0.2 + jitter()), 13 * scale, 7 * scale);
    cypress(W * (0.44 + jitter()), 28 * scale, 7 * scale);
    bush(W * (0.48 + jitter()), 8 * scale, 11 * scale);
    cypress(W * (0.76 + jitter()), 19 * scale, 5.5 * scale);
    bush(W * (0.82 + jitter()), 16 * scale, 6 * scale);

    // One small house on the hill, painted with short strokes and a dark outline.
    (function house(cx, w, h, roofH) {
      var base = horizon(cx) + 2 * scale, left = cx - w / 2, right = cx + w / 2, top = base - h;
      var wall = pal.wall || ["#efe9cf", "#e3dcb8"], roof = pal.roof || ["#8a5a4a", "#3f7a6f"];
      var lw = 1.4 * scale, y, t;
      for (y = top + lw / 2; y < base; y += lw * 0.8) {
        strokes.push({ pts: [[left + r(), y], [right - r(), y + (r() - 0.5) * 0.6]], color: wall[Math.floor(r() * wall.length)], width: lw, alpha: 0.95 });
      }
      var roofColor = roof[0], over = 1.8 * scale;
      for (t = 0; t < 1; t += 0.14) {
        var ry = top - t * roofH, half = (w / 2 + over) * (1 - t);
        strokes.push({ pts: [[cx - half, ry], [cx + half, ry - (r() - 0.5) * 0.6]], color: roofColor, width: lw * 1.1, alpha: 0.95 });
      }
      var ink = pal.dark[0][0];
      strokes.push({ pts: [[left - over, top], [cx, top - roofH], [right + over, top]], color: ink, width: 0.9 * scale, alpha: 0.7 });
      strokes.push({ pts: [[left, top], [left, base]], color: ink, width: 0.8 * scale, alpha: 0.55 });
      strokes.push({ pts: [[right, top], [right, base]], color: ink, width: 0.8 * scale, alpha: 0.55 });
      var wx = cx + w * 0.15, wy = top + h * 0.45;
      strokes.push({ pts: [[wx - scale, wy], [wx + scale, wy]], color: ink, width: 1.8 * scale, alpha: 0.85 });
    })(W * (0.53 + jitter() * 0.5), 15 * scale, 9 * scale, 6 * scale);

    // A flock of birds in the upper left.
    var birds = 18 + Math.floor(r() * 10);
    for (var b = 0; b < birds; b++) {
      var bx = W * (0.14 + Math.pow(r(), 1.3) * 0.2), by = H * (0.1 + r() * 0.16);
      var bw = (1.8 + r() * 2.2) * scale;
      strokes.push({ pts: [[bx - bw, by], [bx - bw / 2, by - bw * 0.55], [bx, by], [bx + bw / 2, by - bw * 0.55], [bx + bw, by]], color: pal.bird, width: 1.1 * scale, alpha: 0.75 });
    }

    return { strokes: strokes, horizon: horizon };
  }

  function paint(canvas, animate) {
    var rect = canvas.getBoundingClientRect();
    var W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    var pal = PALETTES[canvas.dataset.palette] || PALETTES.harrow;
    var seed = parseInt(canvas.dataset.seed, 10) || 1;
    var scene = buildStrokes(W, H, seed, pal);

    // Ground layer so no gaps show between strokes.
    var hz = scene.horizon(W / 2);
    var g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, pal.skyBase[1]); g.addColorStop(1, pal.skyBase[0]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var x = 0; x <= W; x += 8) ctx.lineTo(x, scene.horizon(x));
    ctx.lineTo(W, scene.horizon(W)); ctx.lineTo(W, H); ctx.closePath();
    var f = ctx.createLinearGradient(0, hz, 0, H);
    f.addColorStop(0, pal.fieldBase[0]); f.addColorStop(1, pal.fieldBase[1]);
    ctx.fillStyle = f; ctx.fill();

    var list = scene.strokes, i = 0;
    function drawBatch(n) {
      var end = Math.min(list.length, i + n);
      for (; i < end; i++) {
        var s = list[i], p = s.pts;
        ctx.globalAlpha = s.alpha; ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
        ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
        for (var j = 1; j < p.length - 1; j++) {
          ctx.quadraticCurveTo(p[j][0], p[j][1], (p[j][0] + p[j + 1][0]) / 2, (p[j][1] + p[j + 1][1]) / 2);
        }
        ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    var token = {};
    canvas._paintToken = token;
    if (!animate) { drawBatch(list.length); return; }
    var perFrame = Math.ceil(list.length / 70);
    (function frame() {
      if (canvas._paintToken !== token) return;
      drawBatch(perFrame);
      if (i < list.length) requestAnimationFrame(frame);
    })();
  }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvases = Array.prototype.slice.call(document.querySelectorAll("canvas.painting"));

  canvases.forEach(function (c) { c._lastWidth = c.getBoundingClientRect().width; });

  // Paint the hero right away; paint gallery placeholders as they scroll into view.
  canvases.forEach(function (c) {
    if (c.id === "hero-canvas" || !("IntersectionObserver" in window)) {
      paint(c, !reduceMotion);
    }
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { paint(e.target, !reduceMotion); io.unobserve(e.target); }
      });
    }, { rootMargin: "100px" });
    canvases.forEach(function (c) { if (c.id !== "hero-canvas") io.observe(c); });
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      canvases.forEach(function (c) {
        var w = c.getBoundingClientRect().width;
        if (Math.abs(w - c._lastWidth) > 2 && c.width > 0) { c._lastWidth = w; paint(c, false); }
      });
    }, 200);
  });

  // Lightbox for real artworks.
  var box = document.getElementById("lightbox");
  if (box) {
    var img = box.querySelector("img"), cap = box.querySelector(".lightbox__caption");
    document.querySelectorAll("button.frame[data-full]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        img.src = btn.dataset.full; img.alt = btn.dataset.caption; cap.textContent = btn.dataset.caption;
        box.hidden = false; document.body.style.overflow = "hidden";
      });
    });
    function close() { box.hidden = true; img.src = ""; document.body.style.overflow = ""; }
    box.addEventListener("click", function (e) { if (e.target !== img) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !box.hidden) close(); });
  }
})();
