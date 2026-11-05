(function() {
  "use strict";
  const meta = document.querySelector('meta[name="site-name"]');
  const SITE_NAME = meta ? meta.getAttribute("content").trim() : "";
  if (!SITE_NAME) return;
  Array.prototype.forEach.call(document.querySelectorAll("[data-site-name]"), function(el) {
    if (el.children.length === 0 && el.textContent !== SITE_NAME) el.textContent = SITE_NAME;
  });
  const SEP = "｜";
  const titleParts = document.title.split(SEP);
  if (titleParts.length > 1 && titleParts[0] !== SITE_NAME) {
    titleParts[0] = SITE_NAME;
    document.title = titleParts.join(SEP);
  }
  const ogSiteName = document.querySelector('meta[property="og:site_name"]');
  if (ogSiteName) ogSiteName.setAttribute("content", SITE_NAME);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", document.title);
})();
