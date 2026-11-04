// The App Store link, in one place. Leave it empty while the app is in beta. The day the app
// is live, paste its App Store URL (https://apps.apple.com/...) between the quotes and publish:
// every [data-store-live] element (Apple's official badge) appears, linked to it, and every
// [data-store-soon] element ("Coming to the App Store" and the like) disappears.
var APP_STORE = "";
(function () {
  if (!APP_STORE) return;
  document.querySelectorAll("[data-store-live]").forEach(function (el) {
    el.hidden = false;
    if (el.tagName === "A") { el.href = APP_STORE; el.target = "_blank"; el.rel = "noopener"; }
  });
  document.querySelectorAll("[data-store-soon]").forEach(function (el) { el.hidden = true; });
})();
