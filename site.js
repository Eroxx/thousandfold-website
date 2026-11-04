// The opening: pick a photo and its picture builds, with Crate's camera. The same landings as Reveal.lift in the app:
// a first screenful one by one, then each photo as the edge of the frame reaches it.
(function () {
  var opening = document.querySelector("[data-opening]");
  if (!opening) return;
  var picture = opening.querySelector("[data-picture]"), canvas = opening.querySelector("[data-canvas]"), caption = opening.querySelector("[data-caption]");
  var again = opening.querySelector("[data-again]"), after = opening.querySelector("[data-after]");
  var picks = opening.querySelectorAll("[data-pick]");
  var ctx = canvas.getContext("2d");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GRID = 48, CLOSE = 12, BUILD = 15, DROP = 0.5;
  var current = null, frame = 0, began = 0, image = null, landings = null;

  function smooth(x) { var c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); }
  function scale(t) { return 1 + (CLOSE - 1) * (1 - smooth(t / BUILD)); }
  function progressAt(s) { var y = Math.max(0, Math.min(1, 1 - (s - 1) / (CLOSE - 1))); return 0.5 - Math.sin(Math.asin(1 - 2 * y) / 3); }

  function makeLandings() {
    var mid = (GRID - 1) / 2, firstScreen = BUILD * 0.15, opener = [], later = [];
    for (var spot = 0; spot < GRID * GRID; spot++) {
      var dx = Math.max(0.001, Math.abs(spot % GRID - mid) - 0.75), dy = Math.max(0.001, Math.abs(Math.floor(spot / GRID) - mid) - 0.75);
      var enters = GRID / (2 * Math.max(dx, dy));
      if (enters >= CLOSE) opener.push({ spot: spot, key: Math.hypot(dx, dy) + Math.random() * 0.4 });
      else {
        var x = progressAt(Math.max(1, enters));
        later.push({ spot: spot, time: Math.min(BUILD, Math.max(firstScreen, x * BUILD + Math.random() * BUILD * 0.05 * (1 - x / 2))) });
      }
    }
    opener.sort(function (a, b) { return a.key - b.key; });
    later.sort(function (a, b) { return a.time - b.time; });
    var step = firstScreen / Math.max(1, opener.length);
    opener.forEach(function (o, i) { o.time = i * step; });
    return opener.concat(later);
  }

  function draw(t) {
    var W = canvas.width, side = W / GRID, s = scale(t), f = Math.max(0, Math.min(1, (s - 1) / (CLOSE - 1))) * s;
    var first = landings[0].spot, panX = -((first % GRID) + 0.5 - GRID / 2) * f * side, panY = -(Math.floor(first / GRID) + 0.5 - GRID / 2) * f * side;
    var left = W / 2 + panX - W * s / 2, top = W / 2 + panY - W * s / 2, size = side * s;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, W);
    ctx.save(); ctx.beginPath();
    var n = 0, i;
    for (i = 0; i < landings.length && landings[i].time <= t - DROP; i++) {
      var sp = landings[i].spot, x = left + (sp % GRID) * size, y = top + Math.floor(sp / GRID) * size;
      if (x < W && y < W && x + size > 0 && y + size > 0) { ctx.rect(x - 0.3, y - 0.3, size + 0.6, size + 0.6); n++; }
    }
    if (n) { ctx.clip(); ctx.imageSmoothingQuality = "high"; ctx.drawImage(image, left, top, W * s, W * s); }
    ctx.restore();
    var cell = image.naturalWidth / GRID;
    for (; i < landings.length && landings[i].time <= t; i++) {
      var d = landings[i], age = Math.min(1, Math.max(0, (t - d.time) / DROP)), lift = Math.pow(1 - age, 2), grow = size * (1 + 1.3 * lift);
      var cx = left + (d.spot % GRID + 0.5) * size, cy = top + (Math.floor(d.spot / GRID) + 0.5) * size;
      if (cx + grow < 0 || cy + grow < 0 || cx - grow > W || cy - grow > W) continue;
      ctx.globalAlpha = 0.35 * Math.min(1, age * 3) * lift; ctx.fillStyle = "#000"; ctx.fillRect(cx - grow / 2, cy - grow / 2 + size * 0.25 * lift, grow, grow);
      ctx.globalAlpha = Math.min(1, age * 3);
      ctx.drawImage(image, (d.spot % GRID) * cell, Math.floor(d.spot / GRID) * cell, cell, cell, cx - grow / 2, cy - grow / 2, grow, grow);
      ctx.globalAlpha = 1;
    }
  }

  function words(t, pick) {
    var name = pick.getAttribute("data-name"), count = Number(pick.getAttribute("data-count")).toLocaleString("en-US");
    var text = t < BUILD * 0.42 ? "In the app, these would be your photos." : t < BUILD * 0.74 ? "Your trips. Your dog. Your kids." : t < BUILD + DROP ? "None of them tinted to fit." : name + ", built from " + count + " other photos.";
    if (caption.textContent !== text) caption.textContent = text;
  }

  function finish(pick) {
    draw(BUILD + DROP + 1); words(BUILD + DROP + 1, pick);
    again.hidden = false; after.hidden = false;
  }

  function play(pick) {
    cancelAnimationFrame(frame);
    current = pick;
    picks.forEach(function (p) { p.classList.toggle("on", p === pick); p.setAttribute("aria-pressed", p === pick); });
    opening.classList.add("playing");
    picture.hidden = false; caption.hidden = false; again.hidden = true; after.hidden = true;
    var size = Math.min(1600, Math.round(picture.clientWidth * Math.min(2, window.devicePixelRatio || 1)));
    canvas.width = canvas.height = size;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, size, size);
    var name = pick.getAttribute("data-pick");
    caption.textContent = "";
    // The full picture for its sharp photos, up close. It starts on whichever is ready first.
    var small = new Image(), full = new Image(), started = false;
    function start(first) {
      if (current !== pick || started) return;
      started = true; image = first; landings = makeLandings(); began = performance.now();
      if (still) { finish(pick); return; }
      (function tick(now) {
        if (current !== pick) return;
        var t = (now - began) / 1000;
        if (t >= BUILD + DROP) { finish(pick); return; }
        draw(t); words(t, pick);
        frame = requestAnimationFrame(tick);
      })(began);
    }
    full.onload = function () { if (current === pick) { if (started) image = full; else start(full); } };
    small.onload = function () { setTimeout(function () { start(small); }, 350); };
    full.src = "img/pick/" + name + "-full.webp";
    small.src = "img/pick/" + name + "-small.webp";
    picture.scrollIntoView && window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  }

  picks.forEach(function (pick) { pick.addEventListener("click", function () { play(pick); }); });
  again.addEventListener("click", function () { if (current) play(current); });
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
