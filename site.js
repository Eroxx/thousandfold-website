// One engine for the opening and the mode player: real mosaics, 48 tiles across, with the app's landings and Crate's camera.
var Build = (function () {
  var GRID = 48, DROP = 0.5, CLOSE = 12, INK = "#17171b";
  function smooth(x) { var c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); }
  function cameraScale(t, over) { return 1 + (CLOSE - 1) * (1 - smooth(t / over)); }
  function progressAt(s) { var y = Math.max(0, Math.min(1, 1 - (s - 1) / (CLOSE - 1))); return 0.5 - Math.sin(Math.asin(1 - 2 * y) / 3); }
  var MID = (GRID - 1) / 2, spots = [];
  for (var n = 0; n < GRID * GRID; n++) spots.push(n);
  function col(s) { return s % GRID; }
  function row(s) { return Math.floor(s / GRID); }
  function away(s) { return Math.hypot(col(s) - MID, row(s) - MID) / Math.hypot(MID, MID); }

  function lift(over) {
    var firstScreen = over * 0.15, opener = [], later = [];
    spots.forEach(function (spot) {
      var dx = Math.max(0.001, Math.abs(col(spot) - MID) - 0.75), dy = Math.max(0.001, Math.abs(row(spot) - MID) - 0.75);
      var enters = GRID / (2 * Math.max(dx, dy));
      if (enters >= CLOSE) opener.push({ spot: spot, key: Math.hypot(dx, dy) + Math.random() * 0.4 });
      else {
        var x = progressAt(Math.max(1, enters));
        later.push({ spot: spot, time: Math.min(over, Math.max(firstScreen, x * over + Math.random() * over * 0.05 * (1 - x / 2))) });
      }
    });
    opener.sort(function (a, b) { return a.key - b.key; });
    later.sort(function (a, b) { return a.time - b.time; });
    var step = firstScreen / Math.max(1, opener.length);
    opener.forEach(function (o, i) { o.time = i * step; });
    return opener.concat(later);
  }

  function sorted(key) {
    return spots.map(function (s) { return { spot: s, key: key(s) }; }).sort(function (a, b) { return a.key - b.key; });
  }

  // When each photo in an order lands: the same two curves as the app.
  function timed(order, over, pulls) {
    var total = order.length, steps = total * 2, i = 0;
    for (var step = 1; step <= steps && i < total; step++) {
      var x = step / steps, t = x * over, s = cameraScale(t, over);
      var share = pulls ? Math.min(1, 1.9 / (s * s) * smooth(x / 0.25)) : Math.min(1, Math.pow(x / 0.95, 1.6));
      var wanted = Math.ceil(total * share);
      while (i < wanted && i < total) { order[i].time = t; i++; }
    }
    while (i < total) { order[i].time = over; i++; }
    return order;
  }

  function brightness(image) {
    var c = document.createElement("canvas"); c.width = c.height = GRID;
    var x = c.getContext("2d"); x.drawImage(image, 0, 0, GRID, GRID);
    var d = x.getImageData(0, 0, GRID, GRID).data;
    return spots.map(function (s) { return (0.3 * d[s * 4] + 0.59 * d[s * 4 + 1] + 0.11 * d[s * 4 + 2]) / 255; });
  }

  function landings(kind, over, image) {
    switch (kind) {
      case "lift": return lift(over);
      case "spiral":
        var turns = GRID / 8;
        return timed(sorted(function (s) {
          var angle = Math.atan2(row(s) - MID, col(s) - MID) / (2 * Math.PI) + 0.5, a = away(s) * turns;
          return Math.floor(a) + angle + (a % 1);
        }), over, true);
      case "bloom":
        var seeds = [0, 1, 2, 3, 4, 5, 6].map(function () { return [Math.random() * GRID, Math.random() * GRID]; });
        return timed(sorted(function (s) {
          return Math.min.apply(null, seeds.map(function (p) { return Math.hypot(p[0] - col(s), p[1] - row(s)); })) + Math.random() * 1.5;
        }), over);
      case "clock":
        return timed(sorted(function (s) {
          var a = Math.atan2(col(s) - MID, MID - row(s)); return (a < 0 ? a + 2 * Math.PI : a) + Math.random() * 0.02;
        }), over);
      case "snake":
        return timed(sorted(function (s) { return row(s) * GRID + (row(s) % 2 === 0 ? col(s) : GRID - 1 - col(s)); }), over);
      case "curtain":
        return timed(sorted(function (s) { return row(s) + Math.random() * 3; }), over);
      case "develop":
        var light = brightness(image);
        return timed(sorted(function (s) { return light[s] + Math.random() * 0.04; }), over);
      default:
        return timed(sorted(function () { return Math.random(); }), over);
    }
  }

  function Player(canvas) {
    var ctx = canvas.getContext("2d"), frame = 0, token = 0, state = null;
    function resize() {
      var size = Math.min(1600, Math.round(canvas.clientWidth * Math.min(2, window.devicePixelRatio || 1))) || 800;
      canvas.width = canvas.height = size;
      ctx.fillStyle = INK; ctx.fillRect(0, 0, size, size);
    }
    function draw(t) {
      var W = canvas.width, side = W / GRID, pulls = state.kind === "lift" || state.kind === "spiral", s = pulls ? cameraScale(t, state.over) : 1;
      var panX = 0, panY = 0, image = state.image, list = state.list;
      if (state.kind === "lift") {
        var f = Math.max(0, Math.min(1, (s - 1) / (CLOSE - 1))) * s, first = list[0].spot;
        panX = -(col(first) + 0.5 - GRID / 2) * f * side; panY = -(row(first) + 0.5 - GRID / 2) * f * side;
      }
      var left = W / 2 + panX - W * s / 2, top = W / 2 + panY - W * s / 2, size = side * s;
      ctx.fillStyle = INK; ctx.fillRect(0, 0, W, W);
      ctx.save(); ctx.beginPath();
      var drawn = 0, i;
      for (i = 0; i < list.length && list[i].time <= t - DROP; i++) {
        var x = left + col(list[i].spot) * size, y = top + row(list[i].spot) * size;
        if (x < W && y < W && x + size > 0 && y + size > 0) { ctx.rect(x - 0.3, y - 0.3, size + 0.6, size + 0.6); drawn++; }
      }
      if (drawn) { ctx.clip(); ctx.imageSmoothingQuality = "high"; ctx.drawImage(image, left, top, W * s, W * s); }
      ctx.restore();
      var cell = image.naturalWidth / GRID;
      for (; i < list.length && list[i].time <= t; i++) {
        var d = list[i], age = Math.min(1, Math.max(0, (t - d.time) / DROP)), up = Math.pow(1 - age, 2), grow = size * (1 + 1.3 * up);
        var cx = left + (col(d.spot) + 0.5) * size, cy = top + (row(d.spot) + 0.5) * size;
        if (cx + grow < 0 || cy + grow < 0 || cx - grow > W || cy - grow > W) continue;
        ctx.globalAlpha = 0.35 * Math.min(1, age * 3) * up; ctx.fillStyle = "#000"; ctx.fillRect(cx - grow / 2, cy - grow / 2 + size * 0.25 * up, grow, grow);
        ctx.globalAlpha = Math.min(1, age * 3);
        ctx.drawImage(image, col(d.spot) * cell, row(d.spot) * cell, cell, cell, cx - grow / 2, cy - grow / 2, grow, grow);
        ctx.globalAlpha = 1;
      }
    }
    return {
      stop: function () { token++; cancelAnimationFrame(frame); },
      // Starts on the small picture for speed, and moves to the sharp one the moment it arrives.
      play: function (name, kind, over, onTick, onDone) {
        var mine = ++token, started = false, small = new Image(), full = new Image(), still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        cancelAnimationFrame(frame); resize();
        function start(first) {
          if (mine !== token || started) return;
          started = true;
          state = { image: first, kind: kind, over: over, list: landings(kind, over, first) };
          if (still) { draw(over + DROP + 1); if (onDone) onDone(); return; }
          var began = performance.now();
          (function tick(now) {
            if (mine !== token) return;
            var t = (now - began) / 1000;
            if (t >= over + DROP) { draw(over + DROP + 1); if (onDone) onDone(); return; }
            draw(t); if (onTick) onTick(t);
            frame = requestAnimationFrame(tick);
          })(began);
        }
        full.onload = function () { if (mine === token) { if (started) state.image = full; else start(full); } };
        small.onload = function () { setTimeout(function () { start(small); }, 350); };
        full.src = "img/pick/" + name + "-full.webp";
        small.src = "img/pick/" + name + "-small.webp";
      }
    };
  }
  return { Player: Player, DROP: DROP };
})();

// The opening: pick a photo and watch it build.
(function () {
  var opening = document.querySelector("[data-opening]");
  if (!opening) return;
  var picture = opening.querySelector("[data-picture]"), caption = opening.querySelector("[data-caption]");
  var again = opening.querySelector("[data-again]"), after = opening.querySelector("[data-after]");
  var picks = opening.querySelectorAll("[data-pick]"), player = Build.Player(opening.querySelector("[data-canvas]"));
  var OVER = 15, current = null;

  function words(t, pick) {
    var name = pick.getAttribute("data-name"), count = Number(pick.getAttribute("data-count")).toLocaleString("en-US");
    var text = t < OVER * 0.42 ? "In the app, these would be your photos." : t < OVER * 0.74 ? "Your trips. Your dog. Your kids." : t < OVER + Build.DROP ? "None of them tinted to fit." : name + ", built from " + count + " other photos.";
    if (caption.textContent !== text) caption.textContent = text;
  }

  function play(pick) {
    current = pick;
    picks.forEach(function (p) { p.classList.toggle("on", p === pick); p.setAttribute("aria-pressed", p === pick); });
    opening.classList.add("playing");
    picture.hidden = false; caption.hidden = false; again.hidden = true; after.hidden = true;
    caption.textContent = "";
    player.play(pick.getAttribute("data-pick"), "lift", OVER, function (t) { words(t, pick); }, function () {
      words(OVER + Build.DROP + 1, pick); again.hidden = false; after.hidden = false;
    });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  picks.forEach(function (pick) { pick.addEventListener("click", function () { play(pick); }); });
  again.addEventListener("click", function () { if (current) play(current); });
})();

// The mode player: one picture, every way the app can build it.
(function () {
  var box = document.querySelector("[data-modes]");
  if (!box) return;
  var player = Build.Player(box.querySelector("canvas")), chips = box.querySelectorAll("[data-mode]"), line = box.querySelector("[data-mode-line]"), again = box.querySelector("[data-mode-again]");
  var REAL = ["lift", "spiral", "bloom", "clock", "snake", "rain", "curtain", "develop"], last = null, chosen = null;
  function play(chip) {
    chosen = chip;
    chips.forEach(function (c) { c.classList.toggle("on", c === chip); c.setAttribute("aria-pressed", c === chip); });
    var kind = chip.getAttribute("data-mode");
    if (kind === "random") { var others = REAL.filter(function (k) { return k !== last; }); kind = others[Math.floor(Math.random() * others.length)]; }
    last = kind;
    line.innerHTML = "<b>" + chip.textContent + (chip.getAttribute("data-mode") === "random" ? " (" + kind.replace("lift", "camera lift") + ")" : "") + ":</b> " + chip.getAttribute("data-detail");
    again.hidden = true;
    player.play("lighthouse", kind, kind === "lift" ? 12 : 9, null, function () { again.hidden = false; });
  }
  chips.forEach(function (chip) { chip.addEventListener("click", function () { play(chip); }); });
  again.addEventListener("click", function () { if (chosen) play(chosen); });
  // Starts by itself the first time it comes into view.
  if ("IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { seen.disconnect(); if (!chosen) play(chips[0]); }
    }, { threshold: 0.35 });
    seen.observe(box.querySelector("canvas"));
  } else { play(chips[0]); }
})();

// Photo against picture.
document.querySelectorAll("[data-compare]").forEach(function (box) {
  var range = box.querySelector("input");
  range.addEventListener("input", function () { box.style.setProperty("--at", range.value + "%"); });
});

// The same balloon at every size the app offers, each really built at that size.
(function () {
  var box = document.querySelector("[data-compare]"), row = document.querySelector("[data-sizes]");
  if (!box || !row) return;
  var mosaic = box.querySelector("[data-compare-mosaic]"), count = box.querySelector("[data-compare-count]"), line = document.querySelector("[data-size-line]");
  var buttons = row.querySelectorAll("[data-size]");
  function src(b) { return "img/sizes/balloon-" + b.getAttribute("data-size") + ".webp"; }
  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      buttons.forEach(function (o) { o.classList.toggle("on", o === b); o.setAttribute("aria-pressed", o === b); });
      mosaic.src = src(b);
      count.textContent = b.getAttribute("data-distinct") + " different photos";
      line.innerHTML = "<b>" + b.getAttribute("data-name") + ":</b> " + b.getAttribute("data-effect");
    });
  });
  // Ready before the first press, so a size changes at once.
  if ("IntersectionObserver" in window) {
    var near = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { buttons.forEach(function (b) { new Image().src = src(b); }); near.disconnect(); }
    }, { rootMargin: "300px 0px" });
    near.observe(box);
  }
})();

// Films load as they come near, play on screen and rest off it. With Reduce Motion they wait to be asked.
(function () {
  var vids = document.querySelectorAll("video[data-video]");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("IntersectionObserver" in window)) return;
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.getAttribute("src")) { v.src = v.getAttribute("data-src"); }
        if (still) { v.controls = true; return; }
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else { v.pause(); }
    });
  }, { rootMargin: "200px 0px" });
  vids.forEach(function (v) { seen.observe(v); });
})();
