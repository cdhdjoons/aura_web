document.addEventListener("DOMContentLoaded", () => {
  const DEV_MODE = false;
  const DEV_STORAGE_KEY = "aura-products-position-draft";
  const dataUrl = "data/products.json";

  const TOTAL_PANELS = 3;
  let currentPanelIndex = 1;

  const productList = document.getElementById("product-list");
  const hotspotLayer = document.getElementById("hotspot-layer");
  const showroom = document.querySelector(".showroom");
  const showroomArea = document.querySelector(".showroom-bg");

  const showroomPrev = document.getElementById("showroomPrev");
  const showroomNext = document.getElementById("showroomNext");

  const modalOverlay = document.getElementById("modalOverlay");
  let modal = document.querySelector(".modal");

  const allProductsBtn = document.getElementById("all-products-btn");
  const productPanel = document.getElementById("productPanel");
  const panelClose = document.getElementById("panel-close");
  const filterButtons = document.getElementById("filterButtons");
  const panelProductList = document.getElementById("panelProductList");

  let selectedProduct = null;
  let allProducts = [];
  let currentFilter = "all";
  let siteUrlForCurrentProduct = "";
  let modalSliderTimer = null;

  let cameraAnimationFrame = null;
  let isCameraMoving = false;

  const commonImageBase = "images/common/";
  const labelImageBase = "images/labels/";
  const productImageBase = "images/products/";
  const badgeImageBase = "images/badges/";

  const PANORAMA_IMAGE_WIDTH = 2048;
  const PANORAMA_IMAGE_HEIGHT = 431;
  const PANORAMA_IMAGE_RATIO = PANORAMA_IMAGE_WIDTH / PANORAMA_IMAGE_HEIGHT;

  const AUTO_IMAGE_MAX_COUNT = 10;
  const imageExistsCache = new Map();

  let siteSettings = {
    commonLogo: "aura-logo.png",
    halalBadge: "halal.png",
    categoryLabels: {
      beauty: "label-beauty.png",
      food: "label-food.png",
    },
  };

  if (modalOverlay && !modal) {
    modal = document.createElement("div");
    modal.className = "modal";
    modalOverlay.appendChild(modal);
  }

  function ensureShowroomPanels() {
    return;
  }

  ensureShowroomPanels();

  function applyCameraTurnEffect() {
    return;
  }

  function finishCameraTurnEffect() {
    return;
  }

  function applySavedPositions(products) {
    if (!DEV_MODE) return products;

    const saved = localStorage.getItem(DEV_STORAGE_KEY);
    if (!saved) return products;

    try {
      const savedPositions = JSON.parse(saved);

      return products.map((product) => {
        const savedProduct = savedPositions.find(
          (item) => String(item.id) === String(product.id)
        );

        if (!savedProduct) return product;

        return {
          ...product,
          x: Number(savedProduct.x),
          y: Number(savedProduct.y),
        };
      });
    } catch (error) {
      console.warn("저장된 포인터 위치를 불러오지 못했습니다.", error);
      return products;
    }
  }

  function getPositionData() {
    return allProducts.map((product) => ({
      id: product.id,
      x: Number(product.x),
      y: Number(product.y),
    }));
  }

  function savePositionsToLocalStorage() {
    const positionData = getPositionData();
    localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(positionData, null, 2));

    console.log("포인터 위치가 브라우저에 저장되었습니다.");
    console.table(positionData);
  }

  function downloadUpdatedProductsJson() {
    const exportData = {
      settings: siteSettings,
      products: allProducts,
    };

    const jsonText = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "products.json";
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function createDevToolbar() {
    if (!DEV_MODE) return;

    if (document.querySelector(".dev-toolbar")) return;

    const toolbar = document.createElement("div");
    toolbar.className = "dev-toolbar";

    toolbar.innerHTML = `
      <button type="button" class="dev-save-btn">
        Save Positions
      </button>

      <button type="button" class="dev-clear-btn">
        Clear Saved
      </button>
    `;

    document.body.appendChild(toolbar);

    const saveButton = toolbar.querySelector(".dev-save-btn");
    const clearButton = toolbar.querySelector(".dev-clear-btn");

    saveButton.addEventListener("click", () => {
      savePositionsToLocalStorage();
      downloadUpdatedProductsJson();

      saveButton.textContent = "Saved!";
      setTimeout(() => {
        saveButton.textContent = "Save Positions";
      }, 1200);
    });

    clearButton.addEventListener("click", () => {
      localStorage.removeItem(DEV_STORAGE_KEY);

      clearButton.textContent = "Cleared!";
      setTimeout(() => {
        clearButton.textContent = "Clear Saved";
      }, 1200);

      console.log("브라우저에 저장된 포인터 위치를 삭제했습니다.");
    });
  }

  function getPanoramaMetrics() {
    if (!showroom || !showroomArea) {
      return {
        imageLeft: 0,
        imageTop: 0,
        imageWidth: 0,
        imageHeight: 0,
        maxScroll: 0,
      };
    }

    const viewportWidth = showroom.clientWidth;
    const stageWidth = showroomArea.clientWidth;
    const stageHeight = showroomArea.clientHeight;

    const safeStageHeight = Math.max(1, stageHeight);
    const stageRatio = stageWidth / safeStageHeight;

    let imageWidth;
    let imageHeight;

    if (stageRatio > PANORAMA_IMAGE_RATIO) {
      imageHeight = safeStageHeight;
      imageWidth = imageHeight * PANORAMA_IMAGE_RATIO;
    } else {
      imageWidth = stageWidth;
      imageHeight = imageWidth / PANORAMA_IMAGE_RATIO;
    }

    const imageLeft = Math.max(0, (stageWidth - imageWidth) / 2);
    const imageTop = Math.max(0, (safeStageHeight - imageHeight) / 2);
    const maxScroll = Math.max(0, imageWidth - viewportWidth);

    return {
      imageLeft,
      imageTop,
      imageWidth,
      imageHeight,
      maxScroll,
    };
  }

  function setHotspotPosition(button, product) {
    if (!button || !product) return;

    const { imageLeft, imageTop, imageWidth, imageHeight } = getPanoramaMetrics();

    const x = Number(product.x) || 0;
    const y = Number(product.y) || 0;

    const leftPx = imageLeft + imageWidth * (x / 100);
    const topPx = imageTop + imageHeight * (y / 100);

    button.style.left = `${leftPx}px`;
    button.style.top = `${topPx}px`;
  }

  function updateAllHotspotPositions() {
    if (!hotspotLayer) return;

    const buttons = hotspotLayer.querySelectorAll(".hotspot");

    buttons.forEach((button) => {
      const productId = button.dataset.productId;
      const product = allProducts.find((item) => String(item.id) === String(productId));

      if (product) {
        setHotspotPosition(button, product);
      }
    });
  }

  function getPanelTargetLeft(index) {
    const safeIndex = Math.max(0, Math.min(TOTAL_PANELS - 1, index));
    const { imageLeft, maxScroll } = getPanoramaMetrics();

    if (TOTAL_PANELS <= 1) {
      return imageLeft;
    }

    const progress = safeIndex / (TOTAL_PANELS - 1);
    return imageLeft + maxScroll * progress;
  }

  let connectionSvg = document.querySelector(".connection-svg");

  if (!connectionSvg) {
    connectionSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    connectionSvg.classList.add("connection-svg");
    connectionSvg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("connection-path");

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.classList.add("connection-dot");
    dot.setAttribute("r", "4");

    connectionSvg.appendChild(path);
    connectionSvg.appendChild(dot);
    document.body.appendChild(connectionSvg);
  }

  function getConnectionPath() {
    return connectionSvg ? connectionSvg.querySelector(".connection-path") : null;
  }

  function getConnectionDot() {
    return connectionSvg ? connectionSvg.querySelector(".connection-dot") : null;
  }

  function resetConnectionLine() {
    if (!connectionSvg) return;

    const path = getConnectionPath();
    const dot = getConnectionDot();

    if (path) {
      path.classList.remove("is-active");
      path.setAttribute("d", "");
      path.style.strokeDasharray = "";
      path.style.strokeDashoffset = "";
    }

    if (dot) {
      dot.classList.remove("is-active");
      dot.setAttribute("cx", "0");
      dot.setAttribute("cy", "0");
    }

    connectionSvg.classList.remove("is-visible");
  }

  function drawConnectionLineFromHotspot(hotspotButton) {
    if (!connectionSvg || !modal || !hotspotButton) return;

    const path = getConnectionPath();
    const dot = getConnectionDot();

    if (!path || !dot) return;

    const hotspotRect = hotspotButton.getBoundingClientRect();
    const modalRect = modal.getBoundingClientRect();

    const startX = hotspotRect.left + hotspotRect.width / 2;
    const startY = hotspotRect.top + hotspotRect.height / 2;

    const modalCenterX = modalRect.left + modalRect.width / 2;
    const isLeftSide = startX < modalCenterX;
    const endX = isLeftSide ? modalRect.left : modalRect.right;

    const cornerY = Math.max(modalRect.top + 48, startY - 90);

    const d = `
      M ${startX} ${startY}
      L ${startX} ${cornerY}
      L ${endX} ${cornerY}
    `;

    path.setAttribute("d", d);

    dot.setAttribute("cx", startX);
    dot.setAttribute("cy", startY);

    const verticalLength = Math.abs(startY - cornerY);
    const horizontalLength = Math.abs(endX - startX);
    const totalLength = verticalLength + horizontalLength;

    path.style.strokeDasharray = totalLength;
    path.style.strokeDashoffset = totalLength;

    connectionSvg.classList.add("is-visible");

    requestAnimationFrame(() => {
      path.classList.add("is-active");
      dot.classList.add("is-active");
      path.style.strokeDashoffset = "0";
    });
  }

  function easeFastPan(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function setCameraMovingState(isMoving, direction = 0) {
    if (!showroom) return;

    showroom.classList.toggle("is-camera-moving", isMoving);
    showroom.classList.toggle("is-moving-left", isMoving && direction < 0);
    showroom.classList.toggle("is-moving-right", isMoving && direction > 0);
  }

  function animateShowroomTo(targetLeft, duration = 520, direction = 0, toIndex = currentPanelIndex) {
    if (!showroom) return;

    if (cameraAnimationFrame) {
      cancelAnimationFrame(cameraAnimationFrame);
    }

    const startLeft = showroom.scrollLeft;
    const distance = targetLeft - startLeft;
    const startTime = performance.now();

    isCameraMoving = true;
    setCameraMovingState(true, direction);
    resetConnectionLine();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeFastPan(progress);

      showroom.scrollLeft = startLeft + distance * easedProgress;

      if (progress < 1) {
        cameraAnimationFrame = requestAnimationFrame(step);
      } else {
        showroom.scrollLeft = targetLeft;
        cameraAnimationFrame = null;
        isCameraMoving = false;

        setTimeout(() => {
          setCameraMovingState(false, 0);
          finishCameraTurnEffect(toIndex);
          updateCurrentPanelFromScroll();
          updateAllHotspotPositions();
          updateShowroomNavButtons();
        }, 70);
      }
    }

    cameraAnimationFrame = requestAnimationFrame(step);
  }

  function goToPanel(index, smooth = true) {
    if (!showroom) return;

    const previousIndex = currentPanelIndex;
    const nextIndex = Math.max(0, Math.min(TOTAL_PANELS - 1, index));
    const direction = nextIndex - previousIndex;

    currentPanelIndex = nextIndex;

    const targetLeft = getPanelTargetLeft(nextIndex);

    if (!smooth || direction === 0) {
      showroom.scrollLeft = targetLeft;
      finishCameraTurnEffect(nextIndex);
      updateCurrentPanelFromScroll();
      updateAllHotspotPositions();
      updateShowroomNavButtons();
      return;
    }

    applyCameraTurnEffect(previousIndex, nextIndex);
    animateShowroomTo(targetLeft, 520, direction, nextIndex);
    updateShowroomNavButtons();
  }

  function centerShowroomOnLoad() {
    goToPanel(1, false);

    setTimeout(() => {
      goToPanel(1, false);
      updateAllHotspotPositions();
      updateShowroomNavButtons();
    }, 50);
  }

  function moveShowroom(direction) {
    if (isCameraMoving) return;
    goToPanel(currentPanelIndex + direction, true);
  }

  function updateCurrentPanelFromScroll() {
    if (!showroom) return;

    const { imageLeft, maxScroll } = getPanoramaMetrics();

    if (maxScroll <= 0) {
      currentPanelIndex = 1;
      updateShowroomNavButtons();
      return;
    }

    const currentProgress = (showroom.scrollLeft - imageLeft) / maxScroll;
    const index = Math.round(currentProgress * (TOTAL_PANELS - 1));

    currentPanelIndex = Math.max(0, Math.min(TOTAL_PANELS - 1, index));
    updateShowroomNavButtons();
  }

  function updateShowroomNavButtons() {
    if (!showroomPrev || !showroomNext) return;

    if (currentPanelIndex <= 0) {
      showroomPrev.classList.add("is-disabled");
    } else {
      showroomPrev.classList.remove("is-disabled");
    }

    if (currentPanelIndex >= TOTAL_PANELS - 1) {
      showroomNext.classList.add("is-disabled");
    } else {
      showroomNext.classList.remove("is-disabled");
    }
  }

  if (showroomPrev) {
    showroomPrev.addEventListener("click", () => {
      moveShowroom(-1);
    });
  }

  if (showroomNext) {
    showroomNext.addEventListener("click", () => {
      moveShowroom(1);
    });
  }

  let scrollTimer = null;

  if (showroom) {
    showroom.addEventListener("scroll", () => {
      if (isCameraMoving) return;

      clearTimeout(scrollTimer);

      scrollTimer = setTimeout(() => {
        updateCurrentPanelFromScroll();
        updateAllHotspotPositions();
      }, 80);
    });
  }

  let resizeTimer = null;

  function handleResize() {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      goToPanel(currentPanelIndex, false);
      updateAllHotspotPositions();
      updateShowroomNavButtons();
      resetConnectionLine();
    }, 150);
  }

  window.addEventListener("resize", handleResize);

  function getPointerPositionPercent(event) {
    if (!showroomArea) {
      return { x: 50, y: 50 };
    }

    const rect = showroomArea.getBoundingClientRect();
    const { imageLeft, imageTop, imageWidth, imageHeight } = getPanoramaMetrics();

    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    const x = ((localX - imageLeft) / imageWidth) * 100;
    const y = ((localY - imageTop) / imageHeight) * 100;

    return {
      x: Math.max(0, Math.min(100, parseFloat(x.toFixed(2)))),
      y: Math.max(0, Math.min(100, parseFloat(y.toFixed(2)))),
    };
  }

  function printProductPosition(product, x, y) {
    console.log(
      `제품 위치 수정값\nid: ${product.id}\nproductName: ${product.productName}\n"x": ${x},\n"y": ${y}`
    );

    console.log(
      JSON.stringify(
        {
          id: product.id,
          productName: product.productName,
          x,
          y,
        },
        null,
        2
      )
    );
  }

  function getCategoryLabelImage(product) {
    if (product.categoryLabelImage) {
      return product.categoryLabelImage;
    }

    if (product.category && siteSettings.categoryLabels[product.category]) {
      return siteSettings.categoryLabels[product.category];
    }

    return "";
  }

  function checkImageExists(src) {
    if (imageExistsCache.has(src)) {
      return Promise.resolve(imageExistsCache.get(src));
    }

    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        imageExistsCache.set(src, true);
        resolve(true);
      };

      img.onerror = () => {
        imageExistsCache.set(src, false);
        resolve(false);
      };

      img.src = src;
    });
  }

  async function getProductImages(product) {
    let baseImage = "";

    if (Array.isArray(product.productImages) && product.productImages.length > 1) {
      return product.productImages;
    }

    if (Array.isArray(product.productImages) && product.productImages.length === 1) {
      baseImage = product.productImages[0];
    } else if (product.productImage) {
      baseImage = product.productImage;
    }

    if (!baseImage) {
      return [];
    }

    const match = baseImage.match(/^(.+)-1\.(png|jpg|jpeg|webp)$/i);

    let prefix = "";
    let ext = "";

    if (match) {
      prefix = match[1];
      ext = match[2];
    } else {
      const extMatch = baseImage.match(/\.(png|jpg|jpeg|webp)$/i);
      ext = extMatch ? extMatch[1] : "png";
      prefix = String(product.id);
    }

    const images = [];

    for (let i = 1; i <= AUTO_IMAGE_MAX_COUNT; i++) {
      const fileName = `${prefix}-${i}.${ext}`;
      const src = `${productImageBase}${fileName}`;
      const exists = await checkImageExists(src);

      if (!exists) {
        break;
      }

      images.push(fileName);
    }

    if (images.length === 0) {
      return [baseImage];
    }

    console.log(`상품 ${product.id} 이미지 자동 탐색 결과:`, images);

    return images;
  }

  function clearModalSlider() {
    if (modalSliderTimer) {
      clearInterval(modalSliderTimer);
      modalSliderTimer = null;
    }
  }

  function renderModalSlides(productImages) {
    if (!productImages.length) {
      return `
        <div class="modal-product-empty">
          No Image
        </div>
      `;
    }

    return productImages
      .map((image, index) => {
        const activeClass = index === 0 ? "is-active" : "";

        return `
          <img
            class="modal-product-image ${activeClass}"
            src="${productImageBase}${image}"
            alt="Product image ${index + 1}"
            data-slide-index="${index}"
          />
        `;
      })
      .join("");
  }

  function startModalSlider(productImages) {
    clearModalSlider();

    if (!modal || productImages.length <= 1) return;

    const slides = modal.querySelectorAll(".modal-product-image");
    const dots = modal.querySelectorAll(".modal-slide-dot");
    let currentSlide = 0;

    function showSlide(index) {
      slides.forEach((slide) => slide.classList.remove("is-active"));
      dots.forEach((dot) => dot.classList.remove("is-active"));

      if (slides[index]) {
        slides[index].classList.add("is-active");
      }

      if (dots[index]) {
        dots[index].classList.add("is-active");
      }

      currentSlide = index;
    }

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const index = Number(dot.dataset.slideIndex);
        showSlide(index);
      });
    });

    modalSliderTimer = setInterval(() => {
      const nextSlide = (currentSlide + 1) % productImages.length;
      showSlide(nextSlide);
    }, 3000);
  }

  async function openModal(product, hotspotButton = null) {
    if (!modal || !modalOverlay) return;

    selectedProduct = product;
    siteUrlForCurrentProduct = product.siteUrl || "";
    clearModalSlider();
    resetConnectionLine();

    const productImages = await getProductImages(product);
    const categoryLabelImage = getCategoryLabelImage(product);
    const commonLogo = product.logoImage || siteSettings.commonLogo;
    const halalBadge = product.halalBadge || siteSettings.halalBadge;

    const companyName = product.companyName || "";
    const companyNameEn = product.companyNameEn || "";
    const productName = product.productName || "";
    const productNameEn = product.productNameEn || "";
    const categoryText = product.categoryText || product.category || "";

    const showHalal = Boolean(product.hasHalal && halalBadge);

    modal.innerHTML = `
      <button class="modal-close" type="button" aria-label="닫기">
        ×
      </button>

      <div class="modal-inner">
        <div class="modal-logo-area">
          ${
            commonLogo
              ? `<img class="modal-common-logo" src="${commonImageBase}${commonLogo}" alt="${product.brandName || "AURA"}" />`
              : `<div class="modal-logo-text">${product.brandName || "AURA"}</div>`
          }
        </div>

        <div class="modal-category-area">
          ${
            categoryLabelImage
              ? `<img class="modal-category-image" src="${labelImageBase}${categoryLabelImage}" alt="${categoryText}" />`
              : `<span class="modal-category-pill">${categoryText}</span>`
          }
        </div>

        <div class="modal-product-stage">
          <div class="modal-product-slider">
            ${renderModalSlides(productImages)}
          </div>

          ${
            showHalal
              ? `<img class="modal-halal-badge" src="${badgeImageBase}${halalBadge}" alt="HALAL" />`
              : ""
          }

          ${
            productImages.length > 1
              ? `<div class="modal-slide-dots">
                  ${productImages
                    .map(
                      (_, index) => `
                        <button
                          type="button"
                          class="modal-slide-dot ${index === 0 ? "is-active" : ""}"
                          data-slide-index="${index}"
                          aria-label="이미지 ${index + 1}"
                        ></button>
                      `
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>

        <div class="modal-info-row">
          <div class="modal-info-item">
            <strong>${companyName}</strong>
            ${companyNameEn ? `<span>(${companyNameEn})</span>` : ""}
          </div>

          <div class="modal-info-item modal-info-product">
            <strong>${productName}</strong>
            ${productNameEn ? `<span>(${productNameEn})</span>` : ""}
          </div>

          <button class="modal-site" type="button" ${siteUrlForCurrentProduct ? "" : "disabled"}>
            SITE <span>▶</span>
          </button>
        </div>
      </div>
    `;

    const closeButton = modal.querySelector(".modal-close");
    const siteButton = modal.querySelector(".modal-site");

    if (closeButton) {
      closeButton.addEventListener("click", closeModal);
    }

    if (siteButton) {
      siteButton.addEventListener("click", () => {
        if (siteUrlForCurrentProduct) {
          window.open(siteUrlForCurrentProduct, "_blank", "noopener,noreferrer");
        }
      });
    }

    modalOverlay.classList.add("active");
    startModalSlider(productImages);

    if (hotspotButton) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          drawConnectionLineFromHotspot(hotspotButton);
        }, 80);
      });
    }
  }

  function closeModal() {
    selectedProduct = null;
    siteUrlForCurrentProduct = "";
    clearModalSlider();
    resetConnectionLine();

    if (modalOverlay) {
      modalOverlay.classList.remove("active");
    }
  }

  function createHotspot(product) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "hotspot";
    button.title = product.productName || "";
    button.dataset.productId = product.id;

    setHotspotPosition(button, product);

    if (DEV_MODE) {
      const number = document.createElement("span");
      number.className = "hotspot-number";
      number.textContent = product.id;
      button.appendChild(number);
    }

    let isDragging = false;
    let hasMoved = false;

    if (DEV_MODE) {
      button.classList.add("is-dev-draggable");

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();

        isDragging = true;
        hasMoved = false;

        button.setPointerCapture(event.pointerId);
        button.classList.add("is-dragging");
      });

      button.addEventListener("pointermove", (event) => {
        if (!isDragging) return;

        event.preventDefault();
        event.stopPropagation();

        hasMoved = true;

        const position = getPointerPositionPercent(event);

        product.x = position.x;
        product.y = position.y;

        setHotspotPosition(button, product);
      });

      button.addEventListener("pointerup", (event) => {
        if (!isDragging) return;

        event.preventDefault();
        event.stopPropagation();

        isDragging = false;
        button.classList.remove("is-dragging");

        const position = getPointerPositionPercent(event);

        product.x = position.x;
        product.y = position.y;

        setHotspotPosition(button, product);

        printProductPosition(product, position.x, position.y);

        setTimeout(() => {
          hasMoved = false;
        }, 0);
      });

      button.addEventListener("pointercancel", () => {
        isDragging = false;
        button.classList.remove("is-dragging");

        setTimeout(() => {
          hasMoved = false;
        }, 0);
      });
    }

    button.addEventListener("click", (event) => {
      event.stopPropagation();

      if (DEV_MODE && hasMoved) {
        return;
      }

      openModal(product, button);
      console.log("Selected product:", product);
    });

    return button;
  }

  function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";

    card.innerHTML = `
      <h3>${product.productName || ""}</h3>
      <p>${product.description || ""}</p>
      <div class="product-meta">
        <span class="product-badge">${product.categoryText || product.category || ""}</span>
        <span>${product.brandName || ""}</span>
      </div>
      <p>${product.companyName || ""}</p>
    `;

    return card;
  }

  async function createPanelProductItem(product) {
    const item = document.createElement("div");
    item.className = "panel-product-item";

    const productImages = await getProductImages(product);
    const firstImage = productImages[0];

    const thumb = firstImage
      ? `<img src="${productImageBase}${firstImage}" alt="${product.productName || ""}" class="panel-product-thumb" />`
      : `<div class="panel-product-thumb empty-thumb">No Image</div>`;

    item.innerHTML = `
      ${thumb}
      <div class="panel-product-info">
        <h3>${product.productName || ""}</h3>
        <p>${product.companyName || ""}</p>
        <p>${product.categoryText || product.category || ""}</p>
      </div>
    `;

    item.addEventListener("click", () => {
      openModal(product);
      closePanel();
    });

    return item;
  }

  function showError(message) {
    console.error(message);

    if (productList) {
      productList.innerHTML = `<p style="color: #f87171;">${message}</p>`;
    }
  }

  if (modalOverlay) {
    modalOverlay.addEventListener("click", (event) => {
      if (event.target === modalOverlay) {
        closeModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (modalOverlay && modalOverlay.classList.contains("active")) {
        closeModal();
      }

      if (productPanel && productPanel.classList.contains("active")) {
        closePanel();
      }
    }

    if (event.key === "ArrowLeft") {
      moveShowroom(-1);
    }

    if (event.key === "ArrowRight") {
      moveShowroom(1);
    }
  });

  if (DEV_MODE && showroomArea) {
    showroomArea.addEventListener("click", (event) => {
      if (event.target.closest(".hotspot")) return;

      const position = getPointerPositionPercent(event);

      console.log("배경 클릭 좌표 / 실제 파노라마 이미지 기준");
      console.log(`"x": ${position.x}, "y": ${position.y}`);
    });
  }

  function openPanel() {
    if (productPanel) {
      productPanel.classList.add("active");
    }
  }

  function closePanel() {
    if (productPanel) {
      productPanel.classList.remove("active");
    }
  }

  function renderFilterButtons() {
    if (!filterButtons) return;

    filterButtons.innerHTML = "";

    const categories = ["all", ...new Set(allProducts.map((p) => p.category).filter(Boolean))];

    categories.forEach((category) => {
      const btn = document.createElement("button");

      btn.className = "filter-btn";
      btn.textContent = category === "all" ? "전체" : category;
      btn.type = "button";

      if (currentFilter === category) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        currentFilter = category;
        renderFilterButtons();
        renderPanelProducts();
      });

      filterButtons.appendChild(btn);
    });
  }

  async function renderPanelProducts() {
    if (!panelProductList) return;

    panelProductList.innerHTML = "";

    const filtered =
      currentFilter === "all"
        ? allProducts
        : allProducts.filter((p) => p.category === currentFilter);

    for (const product of filtered) {
      const item = await createPanelProductItem(product);
      panelProductList.appendChild(item);
    }
  }

  if (allProductsBtn) {
    allProductsBtn.addEventListener("click", openPanel);
  }

  if (panelClose) {
    panelClose.addEventListener("click", closePanel);
  }

  if (productPanel) {
    productPanel.addEventListener("click", (event) => {
      if (event.target === productPanel) {
        closePanel();
      }
    });
  }

  fetch(dataUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load product data.");
      }

      return response.json();
    })
    .then(async (data) => {
      if (!data || !Array.isArray(data.products)) {
        throw new Error("Invalid product data format.");
      }

      if (data.settings) {
        siteSettings = {
          ...siteSettings,
          ...data.settings,
          categoryLabels: {
            ...siteSettings.categoryLabels,
            ...(data.settings.categoryLabels || {}),
          },
        };
      }

      allProducts = applySavedPositions(data.products);

      if (hotspotLayer) {
        hotspotLayer.innerHTML = "";
      }

      if (productList) {
        productList.innerHTML = "";
      }

      allProducts.forEach((product) => {
        const hotspot = createHotspot(product);

        if (hotspotLayer) {
          hotspotLayer.appendChild(hotspot);
        }

        if (productList) {
          productList.appendChild(createProductCard(product));
        }
      });

      renderFilterButtons();
      await renderPanelProducts();
      centerShowroomOnLoad();
      updateAllHotspotPositions();
      createDevToolbar();

      if (DEV_MODE) {
        console.log("DEV_MODE 활성화됨");
        console.log("포인터 위치는 실제 파노라마 이미지 기준으로 고정됩니다.");
        console.log("브라우저 크기가 바뀌어도 같은 이미지 위치에 유지됩니다.");
        console.log("포인터 위에 제품 id 번호가 표시됩니다.");
        console.log("Save Positions 클릭 시 위치가 localStorage에 저장되고 products.json이 다운로드됩니다.");
        console.log("상품 이미지 자동 탐색 기능이 활성화되었습니다.");
        console.log("예: 1-1.png가 기본 이미지이면 1-2.png, 1-3.png를 자동 확인합니다.");
        console.log("만약 productImages 배열이 1장만 있어도 자동 탐색합니다.");
        console.log("파노라마 배경 1장 방식입니다.");
        console.log("배경 파일: images/bg-panorama.png");
        console.log(`파노라마 비율: ${PANORAMA_IMAGE_WIDTH} x ${PANORAMA_IMAGE_HEIGHT}`);
      }
    })
    .catch((error) => {
      console.error("Product load error:", error);
      showError("상품 목록을 불러올 수 없습니다.");
    });
});