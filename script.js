(function initGallery() {
  initMobileMenu();
  initSwiper();
  initImageModal();
})();

function initMobileMenu() {
  const button = document.getElementById("mobile-menu-button");
  const nav = document.getElementById("main-nav");
  if (!button || !nav) return;

  const closeMenu = () => {
    nav.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  };

  const toggleMenu = () => {
    const isOpen = nav.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(isOpen));
  };

  button.addEventListener("click", toggleMenu);
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!nav.classList.contains("is-open")) return;
    if (event.target === button || button.contains(event.target)) return;
    if (event.target === nav || nav.contains(event.target)) return;
    closeMenu();
  });
}

function initSwiper() {
  if (typeof window.Swiper !== "function") return;

  new Swiper(".app-swiper", {
    loop: true,
    speed: 650,
    spaceBetween: 12,
    grabCursor: true,
    pagination: {
      el: ".swiper-pagination",
      clickable: true
    },
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev"
    },
    keyboard: {
      enabled: true
    }
  });
}

function initImageModal() {
  const modal = document.getElementById("image-modal");
  const modalImage = document.getElementById("image-modal-img");
  const closeButton = document.getElementById("image-modal-close");
  const images = document.querySelectorAll(".js-zoomable");

  if (!modal || !modalImage || images.length === 0) return;

  const openModal = (src, alt) => {
    modalImage.src = src;
    modalImage.alt = alt || "Enlarged gallery image";
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modalImage.removeAttribute("src");
    modalImage.removeAttribute("alt");
    document.body.style.overflow = "";
  };

  images.forEach((image) => {
    image.addEventListener("click", () => {
      openModal(image.currentSrc || image.src, image.alt);
    });
  });

  if (closeButton) {
    closeButton.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });
}
