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

window.TENSHOT = window.TENSHOT || {};
window.TENSHOT.videoShowcase = Object.freeze({
  heading: "案例分享",
  labels: Object.freeze({
    openA: "開啟完整影片：案例一",
    openB: "開啟完整影片：案例二",
    titleA: "案例一",
    titleB: "案例二",
    close: "關閉影片",
    unmute: "開啟聲音"
  }),
  items: Object.freeze({
    a: Object.freeze({
      id: "a",
      previewSrc: "assets/video/video-a-preview.mp4",
      fullSrc: "assets/video/video-a-full.mp4",
      poster: "assets/video/video-a-poster.jpg",
      width: 720,
      height: 1280,
      hasAudio: true
    }),
    b: Object.freeze({
      id: "b",
      hidden: true
    })
  })
});
