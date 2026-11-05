(function() {
  "use strict";
  const STAGGER_MS = 80;
  const targets = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (!targets.length) return;
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function groupOf(el) {
    return el.closest("ul, ol") || el.parentElement;
  }
  targets.forEach(function(el) {
    const group = groupOf(el);
    const members = targets.filter(function(other) {
      return groupOf(other) === group;
    });
    el.style.setProperty("--reveal-delay", members.indexOf(el) * STAGGER_MS + "ms");
  });
  document.documentElement.classList.add("has-reveal");
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
  targets.forEach(function(el) {
    observer.observe(el);
  });
})();
