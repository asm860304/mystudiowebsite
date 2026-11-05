(function() {
  "use strict";
  const DESKTOP_QUERY = "(min-width: 1200px)";
  const SCROLL_THRESHOLD = 8;
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const menu = toggle ? document.getElementById(toggle.getAttribute("aria-controls")) : null;
  if (!header || !toggle || !menu) return;
  const backdrop = document.querySelector(".nav-backdrop");
  const desktopMql = window.matchMedia(DESKTOP_QUERY);
  function isOpen() {
    return toggle.getAttribute("aria-expanded") === "true";
  }
  function getFocusable() {
    const items = Array.prototype.slice.call(menu.querySelectorAll("a[href], button:not([disabled])"));
    return [toggle].concat(items);
  }
  function openMenu() {
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "關閉選單");
    menu.classList.add("is-open");
    if (backdrop) backdrop.classList.add("is-visible");
    document.body.classList.add("is-nav-open");
    const first = menu.querySelector("a[href]");
    if (first) first.focus();
  }
  function closeMenu(options) {
    const returnFocus = !options || options.returnFocus !== false;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "開啟選單");
    menu.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-visible");
    document.body.classList.remove("is-nav-open");
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener("click", function() {
    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });
  menu.addEventListener("click", function(event) {
    if (event.target.closest("a[href]") && isOpen()) {
      closeMenu({ returnFocus: false });
    }
  });
  document.addEventListener("keydown", function(event) {
    if (!isOpen()) return;
    if (event.key === "Escape") {
      closeMenu();
      return;
    }
    if (event.key === "Tab") {
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.addEventListener("click", function(event) {
    if (isOpen() && !menu.contains(event.target) && !toggle.contains(event.target)) {
      closeMenu({ returnFocus: false });
    }
  });
  function handleBreakpoint(e) {
    if (e.matches && isOpen()) closeMenu({ returnFocus: false });
  }
  if (desktopMql.addEventListener) {
    desktopMql.addEventListener("change", handleBreakpoint);
  } else {
    desktopMql.addListener(handleBreakpoint);
  }
  let ticking = false;
  function updateScrolled() {
    header.classList.toggle("is-scrolled", window.scrollY > SCROLL_THRESHOLD);
    ticking = false;
  }
  window.addEventListener("scroll", function() {
    if (!ticking) {
      window.requestAnimationFrame(updateScrolled);
      ticking = true;
    }
  }, { passive: true });
  updateScrolled();
  if (!("IntersectionObserver" in window)) return;
  const links = Array.prototype.slice.call(menu.querySelectorAll('a[href^="#"]'));
  const linkById = {};
  const sections = [];
  links.forEach(function(link) {
    const id = link.getAttribute("href").slice(1);
    const section = document.getElementById(id);
    if (section) {
      linkById[id] = link;
      sections.push(section);
    }
  });
  function setActive(id) {
    links.forEach(function(link) {
      const active = link === linkById[id];
      link.classList.toggle("is-active", active);
      if (active) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
    checkBottom();
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach(function(section) {
    observer.observe(section);
  });
  let lastId = null;
  let lastTop = -Infinity;
  sections.forEach(function(section) {
    const top = section.getBoundingClientRect().top + window.scrollY;
    if (top > lastTop) {
      lastTop = top;
      lastId = section.id;
    }
  });
  function checkBottom() {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom && lastId) setActive(lastId);
  }
  window.addEventListener("scroll", checkBottom, { passive: true });
  checkBottom();
  const hero = document.getElementById("hero");
  if (hero) {
    new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) setActive(null);
    }, { rootMargin: "-45% 0px -50% 0px" }).observe(hero);
  }
})();
