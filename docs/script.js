(function initGallery() {
  initSwiper();
  initImageModal();
})();

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
