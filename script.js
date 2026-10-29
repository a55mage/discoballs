(function initSite() {
  initTheme();
  initMobileMenu();
  initDownloads();
  const swiper = initSwiper();
  initGalleryTabs(swiper);
  initImageModal();
  initReveal();
  initCurrentSection();
})();

/* ---------- Theme: follows the system until the visitor picks one ---------- */
function currentTheme() {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initTheme() {
  const button = document.getElementById("theme-toggle");
  const apply = () => {
    const theme = currentTheme();
    if (button) {
      const next = theme === "dark" ? "light" : "dark";
      button.setAttribute("aria-label", `Switch to ${next} theme`);
      button.innerHTML = `<i class="fa-solid fa-${theme === "dark" ? "sun" : "moon"}" aria-hidden="true"></i>`;
    }
  };
  button?.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("discoballs-site-theme", next);
    } catch (error) {
      // Private mode: the choice lasts for this visit only.
    }
    apply();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", apply);
  apply();
}

/* ---------- Mobile menu ---------- */
function initMobileMenu() {
  const button = document.getElementById("mobile-menu-button");
  const nav = document.getElementById("main-nav");
  if (!button || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
  };

  button.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (!nav.classList.contains("is-open")) return;
    if (button.contains(event.target) || nav.contains(event.target)) return;
    setOpen(false);
  });
}

/* ---------- Downloads: highlight the visitor's system and point the main button at its file ---------- */
function detectOs() {
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent;
  if (/mac/i.test(platform)) return "mac";
  if (/win/i.test(platform)) return "windows";
  if (/linux|x11/i.test(platform) && !/android/i.test(navigator.userAgent)) return "linux";
  return "";
}

function initDownloads() {
  const os = detectOs();
  const row = os ? document.querySelector(`.platform[data-os="${os}"]`) : null;
  const button = document.getElementById("primary-download");
  const label = document.getElementById("primary-download-label");
  if (!row || !button || !label) return;
  row.classList.add("is-yours");
  const file = row.querySelector("[data-primary]");
  if (!file) return;
  button.setAttribute("href", file.getAttribute("href"));
  label.textContent = `Download for ${{ mac: "macOS", windows: "Windows", linux: "Linux" }[os]}`;
}

/* ---------- Gallery ---------- */
function initSwiper() {
  if (typeof window.Swiper !== "function") return null;
  return new Swiper(".app-swiper", {
    loop: true,
    speed: 650,
    grabCursor: true,
    navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
    keyboard: { enabled: true },
  });
}

function initGalleryTabs(swiper) {
  const tabs = Array.from(document.querySelectorAll(".gallery-tabs [data-slide]"));
  if (!tabs.length) return;
  const select = (index) => {
    tabs.forEach((tab, tabIndex) => tab.setAttribute("aria-selected", String(tabIndex === index)));
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      select(index);
      swiper?.slideToLoop(index);
    });
  });
  swiper?.on("slideChange", () => select(swiper.realIndex));
}

function initImageModal() {
  const modal = document.getElementById("image-modal");
  const modalImage = document.getElementById("image-modal-img");
  const closeButton = document.getElementById("image-modal-close");
  if (!modal || !modalImage) return;

  const close = () => {
    modal.hidden = true;
    modalImage.removeAttribute("src");
    document.body.style.overflow = "";
  };
  document.querySelectorAll(".js-zoomable").forEach((image) => {
    image.addEventListener("click", () => {
      modalImage.src = image.currentSrc || image.src;
      modalImage.alt = image.alt || "Enlarged screenshot";
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      closeButton?.focus();
    });
  });
  closeButton?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });
}

/* ---------- Sections fade in as they scroll into view ---------- */
function initReveal() {
  const targets = document.querySelectorAll(".section__head, .gallery-tabs, .shots, .feature, .project__card");
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  targets.forEach((target) => {
    target.classList.add("reveal");
    observer.observe(target);
  });
}

/* ---------- The nav marks the section on screen ---------- */
function initCurrentSection() {
  const links = Array.from(document.querySelectorAll(".nav a"));
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if (!("IntersectionObserver" in window) || !sections.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === `#${entry.target.id}`));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((section) => observer.observe(section));
}
