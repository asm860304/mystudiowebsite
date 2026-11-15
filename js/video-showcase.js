/**
 * Video showcase: muted in-view previews, lightbox for the full clip.
 * - No user-facing preview pause/play control
 * - Offscreen / hidden-tab / lightbox-open: auto-pause
 * - prefers-reduced-motion (initial and matchMedia change): no autoplay,
 *   unload preview src, show poster + decorative ▶ only
 * - Lightbox: the first item keeps AAC + volume + unmute fallback
 * - A second item is a hidden empty figure until config supplies
 *   media paths with hidden:false. JS then builds the card with
 *   createElement only. No second-item media paths are shipped.
 */
(function () {
  "use strict";

  const config = window.TENSHOT && window.TENSHOT.videoShowcase;
  const section = document.getElementById("video-showcase");
  if (!config || !section) return;

  document.documentElement.classList.add("js");

  const labels = config.labels;
  const items = {
    a: Object.assign({}, (config.items && config.items.a) || {}, { root: section.querySelector('[data-video-item="a"]') }),
    b: Object.assign({}, (config.items && config.items.b) || { id: "b", hidden: true }, { root: section.querySelector('[data-video-item="b"]') })
  };
  if (!items.a.root || !items.b.root) return;

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dialog = document.getElementById("video-lightbox");
  const lightboxVideo = dialog ? dialog.querySelector(".video-lightbox__video") : null;
  const lightboxTitle = dialog ? dialog.querySelector("#lightbox-title") : null;
  const closeBtn = dialog ? dialog.querySelector(".video-lightbox__close") : null;
  const unmuteBtn = dialog ? dialog.querySelector(".video-lightbox__unmute") : null;
  if (!dialog || !lightboxVideo || !lightboxTitle || !closeBtn || !unmuteBtn) return;

  const nativeModal = typeof dialog.showModal === "function";
  let reduceMotion = reduceQuery.matches;
  let lightboxOpen = false;
  let lightboxKind = null;
  let lastTrigger = null;
  let playRequestId = 0;
  let pointerDownOnBackdrop = false;
  let savedScrollY = 0;
  let loadObserver = null;
  let playObserver = null;
  let lightboxCleanupDone = true;
  let fallbackTrapBound = false;
  const fallbackInert = [];
  const viewRatio = { a: 0, b: 0 };

  function prefersReduce() {
    return reduceQuery.matches;
  }

  function saveDataOn() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(conn && conn.saveData);
  }

  function tabHidden() {
    return document.visibilityState === "hidden";
  }

  function getPreview(kind) {
    return items[kind].root.querySelector(".video-showcase__preview");
  }

  function getTrigger(kind) {
    return items[kind].root.querySelector(".video-showcase__trigger");
  }

  function isItemEnabled(kind) {
    const item = items[kind];
    if (!item || !item.root) return false;
    if (item.hidden === true) return false;
    if (!item.previewSrc || !item.fullSrc || !item.poster) return false;
    return true;
  }

  function makeRmHint() {
    const existing = section.querySelector(".video-showcase__rm-hint");
    if (existing) {
      const clone = existing.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      return clone;
    }
    const hint = document.createElement("span");
    hint.className = "video-showcase__rm-hint";
    hint.setAttribute("aria-hidden", "true");
    const disc = document.createElement("span");
    disc.className = "video-showcase__rm-hint-disc";
    hint.appendChild(disc);
    return hint;
  }

  function bindTrigger(kind) {
    const trigger = getTrigger(kind);
    if (!trigger || trigger.getAttribute("data-bound") === "true") return;
    trigger.setAttribute("data-bound", "true");
    trigger.setAttribute("aria-label", kind === "a" ? labels.openA : labels.openB);
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", "video-lightbox");
    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      if (!isItemEnabled(kind)) return;
      openLightbox(kind, trigger);
    });
  }

  /* Build the inner card (trigger / picture / preview / hint) with
     createElement only — used for the empty b slot on a future swap-in.
     Never assigns markup from a string. */
  function buildItemCard(kind) {
    const item = items[kind];
    if (!item || !item.root || !isItemEnabled(kind)) return;
    if (item.root.querySelector(".video-showcase__trigger")) {
      applyItemMedia(kind);
      bindTrigger(kind);
      return;
    }
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "video-showcase__trigger";
    const frame = document.createElement("span");
    frame.className = "video-showcase__frame";
    const picture = document.createElement("picture");
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    picture.appendChild(img);
    const preview = document.createElement("video");
    preview.className = "video-showcase__preview";
    preview.muted = true;
    preview.defaultMuted = true;
    preview.setAttribute("muted", "");
    preview.setAttribute("playsinline", "");
    preview.playsInline = true;
    preview.preload = "metadata";
    preview.setAttribute("aria-hidden", "true");
    preview.tabIndex = -1;
    frame.appendChild(picture);
    frame.appendChild(preview);
    frame.appendChild(makeRmHint());
    trigger.appendChild(frame);
    item.root.appendChild(trigger);
    applyItemMedia(kind);
    bindTrigger(kind);
    initPreview(kind);
  }

  function clearBuiltCard(kind) {
    const item = items[kind];
    if (!item || !item.root) return;
    pausePreview(kind);
    unloadPreview(kind);
    while (item.root.firstChild) item.root.removeChild(item.root.firstChild);
  }

  function applyItemMedia(kind) {
    const item = items[kind];
    if (!item || !item.root) return;
    const img = item.root.querySelector(".video-showcase__frame img");
    const preview = getPreview(kind);
    if (img && item.poster) {
      img.src = item.poster;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      if (item.width) img.width = item.width;
      if (item.height) img.height = item.height;
    }
    if (preview && item.poster) {
      preview.setAttribute("poster", item.poster);
      if (item.width) preview.setAttribute("width", String(item.width));
      if (item.height) preview.setAttribute("height", String(item.height));
    }
  }

  function syncItemSlots() {
    const grid = section.querySelector(".video-showcase__grid");
    let enabledCount = 0;
    ["a", "b"].forEach(function (kind) {
      const item = items[kind];
      if (!item || !item.root) return;
      if (isItemEnabled(kind)) {
        item.root.hidden = false;
        item.root.removeAttribute("hidden");
        buildItemCard(kind);
        enabledCount += 1;
      } else {
        item.root.hidden = true;
        item.root.setAttribute("hidden", "");
        if (kind === "b") {
          clearBuiltCard(kind);
        } else {
          pausePreview(kind);
        }
      }
    });
    if (grid) {
      grid.classList.toggle("video-grid--single", enabledCount <= 1);
    }
  }

  function canAutoplay() {
    return !prefersReduce() && !saveDataOn() && !lightboxOpen && !tabHidden() && !!window.IntersectionObserver;
  }

  function initPreview(kind) {
    const preview = getPreview(kind);
    if (!preview) return;
    preview.muted = true;
    preview.defaultMuted = true;
    preview.setAttribute("muted", "");
    preview.setAttribute("playsinline", "");
    preview.playsInline = true;
    preview.preload = "metadata";
    preview.setAttribute("aria-hidden", "true");
    preview.tabIndex = -1;
    preview.removeAttribute("src");
    preview.removeAttribute("autoplay");
    preview.removeAttribute("loop");
    preview.removeAttribute("data-src-ready");
  }

  function setPreviewSource(kind) {
    if (!isItemEnabled(kind) || prefersReduce()) return;
    const video = getPreview(kind);
    const item = items[kind];
    if (!video || video.getAttribute("data-src-ready") === "true") return;
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.playsInline = true;
    video.preload = "metadata";
    video.poster = item.poster;
    video.src = item.previewSrc;
    video.setAttribute("data-src-ready", "true");
    if (typeof video.load === "function") video.load();
  }

  function pausePreview(kind) {
    const video = getPreview(kind);
    if (!video) return;
    video.pause();
    video.removeAttribute("autoplay");
    video.autoplay = false;
  }

  function unloadPreview(kind) {
    const video = getPreview(kind);
    if (!video) return;
    video.pause();
    video.removeAttribute("autoplay");
    video.removeAttribute("loop");
    video.removeAttribute("src");
    video.removeAttribute("data-src-ready");
    video.autoplay = false;
    video.loop = false;
    try { video.currentTime = 0; } catch (err) { /* ignore */ }
    if (typeof video.load === "function") video.load();
  }

  function tryPlayPreview(kind) {
    if (!isItemEnabled(kind)) return;
    const video = getPreview(kind);
    if (!video || !canAutoplay()) return;
    setPreviewSource(kind);
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.loop = true;
    video.setAttribute("loop", "");
    video.setAttribute("autoplay", "");
    video.autoplay = true;
    const play = video.play();
    if (play && typeof play.catch === "function") {
      play.catch(function () {
        video.removeAttribute("autoplay");
        video.autoplay = false;
      });
    }
  }

  function pauseAllPreviews() {
    pausePreview("a");
    pausePreview("b");
  }

  function tearDownObservers() {
    if (loadObserver) loadObserver.disconnect();
    if (playObserver) playObserver.disconnect();
    loadObserver = null;
    playObserver = null;
    viewRatio.a = 0;
    viewRatio.b = 0;
  }

  function applyReducedMotion(on) {
    reduceMotion = on;
    section.classList.toggle("is-reduced-motion", on);
    if (on) {
      tearDownObservers();
      ["a", "b"].forEach(function (kind) {
        unloadPreview(kind);
      });
    } else if (window.IntersectionObserver && !saveDataOn()) {
      setupObservers();
    }
  }

  function ratioOf(entry) {
    return entry && typeof entry.intersectionRatio === "number" ? entry.intersectionRatio : 0;
  }

  function setupObservers() {
    tearDownObservers();
    if (!window.IntersectionObserver || prefersReduce() || saveDataOn()) return;

    loadObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const kind = entry.target.getAttribute("data-video-item");
        if (!kind || prefersReduce()) return;
        if (entry.isIntersecting) setPreviewSource(kind);
      });
    }, { root: null, rootMargin: "200px 0px", threshold: 0 });

    playObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const kind = entry.target.getAttribute("data-video-item");
        if (!kind) return;
        const ratio = ratioOf(entry);
        viewRatio[kind] = ratio;
        if (!canAutoplay()) {
          pausePreview(kind);
          return;
        }
        if (ratio >= 0.35) {
          tryPlayPreview(kind);
        } else if (ratio < 0.15) {
          pausePreview(kind);
        }
      });
    }, { root: null, rootMargin: "0px", threshold: [0, 0.15, 0.35, 1] });

    ["a", "b"].forEach(function (kind) {
      if (isItemEnabled(kind) && items[kind].root) {
        loadObserver.observe(items[kind].root);
        playObserver.observe(items[kind].root);
      }
    });
  }

  function lockScroll() {
    savedScrollY = window.scrollY;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.classList.add("is-video-lightbox-open");
    if (gap > 0) document.body.style.paddingRight = gap + "px";
    document.body.style.position = "fixed";
    document.body.style.top = "-" + savedScrollY + "px";
    document.body.style.width = "100%";
  }

  function unlockScroll() {
    document.body.classList.remove("is-video-lightbox-open");
    document.body.style.paddingRight = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    const rootStyle = document.documentElement.style;
    const priorBehavior = rootStyle.scrollBehavior;
    rootStyle.scrollBehavior = "auto";
    if (typeof window.scrollTo === "function") window.scrollTo(0, savedScrollY);
    rootStyle.scrollBehavior = priorBehavior;
  }

  function hideUnmute() {
    unmuteBtn.hidden = true;
    unmuteBtn.setAttribute("hidden", "");
  }

  function showUnmute() {
    unmuteBtn.hidden = false;
    unmuteBtn.removeAttribute("hidden");
  }

  function clearLightboxSource() {
    lightboxVideo.pause();
    try { lightboxVideo.currentTime = 0; } catch (err) { /* ignore */ }
    lightboxVideo.removeAttribute("src");
    lightboxVideo.removeAttribute("autoplay");
    lightboxVideo.muted = true;
    lightboxVideo.defaultMuted = true;
    if (typeof lightboxVideo.load === "function") lightboxVideo.load();
  }

  function dialogIsOpen() {
    return !!(dialog.open || dialog.hasAttribute("open"));
  }

  function focusablesInDialog() {
    const sel = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex=\"-1\"])";
    const found = dialog.querySelectorAll(sel);
    const list = [];
    for (let i = 0; i < found.length; i++) {
      const el = found[i];
      if (el.hidden || el.hasAttribute("hidden")) continue;
      const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) continue;
      list.push(el);
    }
    return list;
  }

  function onFallbackKeydown(event) {
    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (event.key !== "Tab") return;
    const list = focusablesInDialog();
    if (!list.length) {
      event.preventDefault();
      closeBtn.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setPageInert(on) {
    if (on) {
      fallbackInert.length = 0;
      const kids = document.body.children;
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i];
        if (el === dialog) continue;
        fallbackInert.push({ el: el, had: el.hasAttribute("inert") });
        el.setAttribute("inert", "");
      }
    } else {
      fallbackInert.forEach(function (entry) {
        if (!entry.had) entry.el.removeAttribute("inert");
      });
      fallbackInert.length = 0;
    }
  }

  function enableFallbackModal() {
    dialog.setAttribute("open", "");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    setPageInert(true);
    if (!fallbackTrapBound) {
      document.addEventListener("keydown", onFallbackKeydown, true);
      fallbackTrapBound = true;
    }
  }

  function disableFallbackModal() {
    dialog.removeAttribute("open");
    setPageInert(false);
    if (fallbackTrapBound) {
      document.removeEventListener("keydown", onFallbackKeydown, true);
      fallbackTrapBound = false;
    }
  }

  /* Idempotent cleanup: safe when dialog.close() already flipped open=false. */
  function cleanupLightbox() {
    if (lightboxCleanupDone) return;
    lightboxCleanupDone = true;
    hideUnmute();
    playRequestId += 1;
    clearLightboxSource();
    dialog.classList.remove("video-lightbox--a", "video-lightbox--b");
    lightboxOpen = false;
    lightboxKind = null;
    if (!nativeModal) {
      disableFallbackModal();
    }
    unlockScroll();
    const trigger = lastTrigger;
    lastTrigger = null;
    if (trigger && document.contains(trigger)) {
      trigger.focus({ preventScroll: true });
    } else {
      const heading = document.getElementById("video-showcase-title");
      if (heading) heading.setAttribute("tabindex", "-1");
      if (heading) heading.focus({ preventScroll: true });
    }
    if (canAutoplay()) {
      setupObservers();
    }
  }

  function closeLightbox() {
    /* Native path: dialog.close() first so the close event runs cleanup
       after the modal has released focus. Calling focus then close() lets
       the UA overwrite the restored trigger focus. */
    if (nativeModal && typeof dialog.close === "function" && dialogIsOpen()) {
      dialog.close();
      return;
    }
    cleanupLightbox();
    if (!nativeModal && dialog.hasAttribute("open")) {
      dialog.removeAttribute("open");
    }
  }

  function openLightbox(kind, trigger) {
    const item = items[kind];
    if (!item || !isItemEnabled(kind)) return;
    const requestId = ++playRequestId;
    lastTrigger = trigger;
    lightboxKind = kind;
    lightboxOpen = true;
    lightboxCleanupDone = false;
    pauseAllPreviews();

    lightboxTitle.textContent = kind === "a" ? labels.titleA : labels.titleB;
    dialog.classList.toggle("video-lightbox--a", kind === "a");
    dialog.classList.toggle("video-lightbox--b", kind === "b");

    hideUnmute();
    lightboxVideo.poster = item.poster;
    lightboxVideo.src = item.fullSrc;
    lightboxVideo.preload = "metadata";
    lightboxVideo.playsInline = true;
    lightboxVideo.setAttribute("playsinline", "");
    lightboxVideo.controls = true;
    lightboxVideo.removeAttribute("loop");
    lightboxVideo.loop = false;
    lightboxVideo.setAttribute("controls", "");

    if (kind === "a") {
      lightboxVideo.muted = false;
      lightboxVideo.defaultMuted = false;
      lightboxVideo.removeAttribute("muted");
    } else {
      lightboxVideo.muted = true;
      lightboxVideo.defaultMuted = true;
      lightboxVideo.setAttribute("muted", "");
    }

    lockScroll();
    if (nativeModal) {
      dialog.showModal();
    } else {
      enableFallbackModal();
    }
    closeBtn.focus();

    const playResult = lightboxVideo.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(function () {
        if (requestId !== playRequestId || lightboxKind !== kind) return;
        if (kind !== "a") return;
        lightboxVideo.muted = true;
        lightboxVideo.defaultMuted = true;
        showUnmute();
        const mutedPlay = lightboxVideo.play();
        if (mutedPlay && typeof mutedPlay.catch === "function") {
          mutedPlay.catch(function () { /* leave poster / native play control */ });
        }
      });
    }
  }

  function onUnmuteClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (lightboxKind !== "a") return;
    lightboxVideo.muted = false;
    lightboxVideo.defaultMuted = false;
    const playResult = lightboxVideo.play();
    if (playResult && typeof playResult.then === "function") {
      playResult.then(function () {
        hideUnmute();
        lightboxVideo.focus();
      }).catch(function () {
        lightboxVideo.muted = true;
        showUnmute();
      });
    } else {
      hideUnmute();
      lightboxVideo.focus();
    }
  }

  Object.keys(items).forEach(function (kind) {
    if (!isItemEnabled(kind)) return;
    initPreview(kind);
    bindTrigger(kind);
    const img = items[kind].root.querySelector("img");
    const item = items[kind];
    if (img) {
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      if (item.width) img.width = item.width;
      if (item.height) img.height = item.height;
    }
  });

  closeBtn.addEventListener("click", function (event) {
    event.preventDefault();
    closeLightbox();
  });
  unmuteBtn.addEventListener("click", onUnmuteClick);

  dialog.addEventListener("cancel", function (event) {
    event.preventDefault();
    closeLightbox();
  });
  dialog.addEventListener("close", function () {
    cleanupLightbox();
  });

  function isBackdropPointer(event) {
    return event.target && typeof event.target.closest === "function" &&
      !event.target.closest(".video-lightbox__media, .video-lightbox__close, .video-lightbox__unmute");
  }

  dialog.addEventListener("pointerdown", function (event) {
    pointerDownOnBackdrop = event.isPrimary === true && event.button === 0 && !event.ctrlKey && isBackdropPointer(event);
  });
  dialog.addEventListener("pointerup", function (event) {
    const shouldClose = pointerDownOnBackdrop && event.isPrimary === true && event.button === 0 && !event.ctrlKey && isBackdropPointer(event);
    pointerDownOnBackdrop = false;
    if (shouldClose) closeLightbox();
  });
  dialog.addEventListener("pointercancel", function () {
    pointerDownOnBackdrop = false;
  });
  dialog.addEventListener("contextmenu", function () {
    pointerDownOnBackdrop = false;
  });

  document.addEventListener("visibilitychange", function () {
    if (tabHidden()) {
      pauseAllPreviews();
      return;
    }
    if (lightboxOpen || prefersReduce() || !playObserver) return;
    ["a", "b"].forEach(function (kind) {
      if (viewRatio[kind] < 0.35) return;
      const video = getPreview(kind);
      if (!video) return;
      video.muted = true;
      video.setAttribute("muted", "");
      tryPlayPreview(kind);
    });
  });

  if (typeof reduceQuery.addEventListener === "function") {
    reduceQuery.addEventListener("change", function (event) {
      applyReducedMotion(event.matches);
    });
  } else if (typeof reduceQuery.addListener === "function") {
    reduceQuery.addListener(function (event) {
      applyReducedMotion(event.matches);
    });
  }

  syncItemSlots();
  applyReducedMotion(prefersReduce());
  if (window.IntersectionObserver && !prefersReduce() && !saveDataOn()) {
    setupObservers();
  }
})();
