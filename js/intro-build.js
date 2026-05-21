document.addEventListener("DOMContentLoaded", () => {
  const introWrap = document.getElementById("introBuild");
  const canvas = document.getElementById("introBuildCanvas");

  if (!introWrap || !canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const BG_IMAGE_PATH = "images/bg-panorama.png";

  const CONFIG = {
    sampleGap: 16,
    maxParticles: 850,
    buildDuration: 1800,
    lineDuration: 900,
    revealDuration: 1200,
    holdDuration: 300,
    connectDistance: 34,
    pointSizeMin: 0.7,
    pointSizeMax: 2.3,
    dotColor: "255, 245, 255",
    lineColor: "220, 220, 255",
  };

  let width = 0;
  let height = 0;
  let particles = [];
  let bgImage = new Image();
  let animationId = null;
  let startTime = 0;

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getImageCoverRect(imgW, imgH, boxW, boxH) {
    const imgRatio = imgW / imgH;
    const boxRatio = boxW / boxH;

    let drawW;
    let drawH;
    let drawX;
    let drawY;

    if (imgRatio > boxRatio) {
      drawH = boxH;
      drawW = drawH * imgRatio;
      drawX = (boxW - drawW) / 2;
      drawY = 0;
    } else {
      drawW = boxW;
      drawH = drawW / imgRatio;
      drawX = 0;
      drawY = (boxH - drawH) / 2;
    }

    return { drawX, drawY, drawW, drawH };
  }

  function sampleImagePoints(image) {
    const offCanvas = document.createElement("canvas");
    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });

    offCanvas.width = width;
    offCanvas.height = height;

    const fit = getImageCoverRect(image.width, image.height, width, height);

    offCtx.clearRect(0, 0, width, height);
    offCtx.drawImage(image, fit.drawX, fit.drawY, fit.drawW, fit.drawH);

    const imageData = offCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const points = [];

    for (let y = 0; y < height; y += CONFIG.sampleGap) {
      for (let x = 0; x < width; x += CONFIG.sampleGap) {
        const i = (y * width + x) * 4;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 20) continue;

        const brightness = (r + g + b) / 3;
        const colorDelta = Math.max(r, g, b) - Math.min(r, g, b);

        /*
          하늘/단색 면 전체를 다 찍지 않고,
          구조가 있는 부분 위주로 점을 뽑습니다.
        */
        const isStructure =
          brightness > 115 ||
          colorDelta > 22 ||
          (brightness > 70 && Math.random() > 0.72);

        if (!isStructure) continue;

        points.push({
          x,
          y,
          r,
          g,
          b,
          brightness,
        });
      }
    }

    while (points.length > CONFIG.maxParticles) {
      points.splice(Math.floor(Math.random() * points.length), 1);
    }

    return points;
  }

  function createParticles(points) {
    const centerX = width / 2;
    const centerY = height / 2;

    return points.map((point) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.max(width, height) * (0.35 + Math.random() * 0.65);

      return {
        tx: point.x,
        ty: point.y,

        sx: centerX + Math.cos(angle) * radius,
        sy: centerY + Math.sin(angle) * radius,

        x: centerX,
        y: centerY,

        r: point.r,
        g: point.g,
        b: point.b,

        size:
          CONFIG.pointSizeMin +
          Math.random() * (CONFIG.pointSizeMax - CONFIG.pointSizeMin),

        alpha: 0.25 + Math.random() * 0.65,
        seed: Math.random() * Math.PI * 2,
      };
    });
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function drawIntroBackground(progress) {
    const fade = 1 - Math.min(progress, 1) * 0.45;

    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.78
    );

    gradient.addColorStop(0, `rgba(80, 70, 150, ${0.34 * fade})`);
    gradient.addColorStop(0.4, `rgba(32, 30, 74, ${0.76 * fade})`);
    gradient.addColorStop(1, `rgba(7, 8, 20, 1)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawParticles(buildProgress, lineProgress) {
    const easedBuild = easeOutCubic(buildProgress);

    for (const particle of particles) {
      particle.x = particle.sx + (particle.tx - particle.sx) * easedBuild;
      particle.y = particle.sy + (particle.ty - particle.sy) * easedBuild;

      const pulse = 0.9 + Math.sin(buildProgress * 10 + particle.seed) * 0.16;

      ctx.beginPath();
      ctx.arc(
        particle.x,
        particle.y,
        particle.size * pulse,
        0,
        Math.PI * 2
      );

      const colorAlpha = particle.alpha * (0.45 + buildProgress * 0.55);

      ctx.fillStyle = `rgba(${particle.r}, ${particle.g}, ${particle.b}, ${colorAlpha})`;
      ctx.fill();
    }

    if (lineProgress <= 0) return;

    const easedLine = easeInOutCubic(lineProgress);
    ctx.lineWidth = 0.7;

    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];

      /*
        전체 조합을 다 돌면 무거우므로 주변 일부만 연결합니다.
      */
      for (let j = i + 1; j < Math.min(i + 18, particles.length); j++) {
        const b = particles[j];

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > CONFIG.connectDistance) continue;

        const alpha =
          (1 - dist / CONFIG.connectDistance) *
          0.42 *
          easedLine *
          (1 - Math.max(0, lineProgress - 0.65) * 0.75);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${CONFIG.lineColor}, ${alpha})`;
        ctx.stroke();
      }
    }
  }

  function drawImageReveal(progress) {
    if (!bgImage.complete) return;

    const fit = getImageCoverRect(bgImage.width, bgImage.height, width, height);
    const eased = easeInOutCubic(progress);

    ctx.save();
    ctx.globalAlpha = eased;
    ctx.drawImage(bgImage, fit.drawX, fit.drawY, fit.drawW, fit.drawH);
    ctx.restore();

    /*
      면이 형성되는 느낌을 위한 은은한 화이트 베일
    */
    if (progress > 0 && progress < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.22;
      ctx.fillStyle = "rgba(255, 245, 255, 0.55)";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  function animate(now) {
    if (!startTime) startTime = now;

    const elapsed = now - startTime;

    const buildEnd = CONFIG.buildDuration;
    const lineEnd = buildEnd + CONFIG.lineDuration;
    const revealEnd = lineEnd + CONFIG.revealDuration;
    const totalEnd = revealEnd + CONFIG.holdDuration;

    const buildProgress = Math.min(1, elapsed / CONFIG.buildDuration);

    const lineProgress =
      elapsed < buildEnd
        ? 0
        : Math.min(1, (elapsed - buildEnd) / CONFIG.lineDuration);

    const revealProgress =
      elapsed < lineEnd
        ? 0
        : Math.min(1, (elapsed - lineEnd) / CONFIG.revealDuration);

    ctx.clearRect(0, 0, width, height);

    drawIntroBackground(revealProgress);
    drawParticles(buildProgress, lineProgress);
    drawImageReveal(revealProgress);

    if (elapsed < totalEnd) {
      animationId = requestAnimationFrame(animate);
    } else {
      introWrap.classList.add("is-hidden");

      setTimeout(() => {
        cancelAnimationFrame(animationId);
        introWrap.remove();
      }, 950);
    }
  }

  function startIntro() {
    resizeCanvas();

    bgImage.onload = () => {
      const points = sampleImagePoints(bgImage);
      particles = createParticles(points);
      startTime = 0;
      animationId = requestAnimationFrame(animate);
    };

    bgImage.onerror = () => {
      introWrap.classList.add("is-hidden");

      setTimeout(() => {
        introWrap.remove();
      }, 900);
    };

    bgImage.src = BG_IMAGE_PATH;
  }

  let resizeTimer = null;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      resizeCanvas();

      if (bgImage.complete && particles.length > 0) {
        const points = sampleImagePoints(bgImage);
        particles = createParticles(points);
      }
    }, 180);
  });

  startIntro();
});