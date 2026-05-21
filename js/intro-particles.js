document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.getElementById("introParticleWrap");
  const canvas = document.getElementById("introParticles");

  if (!wrap || !canvas) return;

  const ctx = canvas.getContext("2d");

  const CONFIG = {
    duration: 3200,
    fadeOutDelay: 2450,
    removeDelay: 900,
    particleCount: 520,
    centerRadius: 210,
    spreadPower: 3.1,
    minSize: 0.5,
    maxSize: 2.5,
  };

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = window.devicePixelRatio || 1;
  let particles = [];
  let animationFrame = null;
  let startTime = performance.now();

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function createParticles() {
    particles = [];

    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < CONFIG.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const startRadius = Math.random() * CONFIG.centerRadius;
      const endRadius = randomBetween(
        Math.min(width, height) * 0.2,
        Math.max(width, height) * 0.72
      );

      const startX = centerX + Math.cos(angle) * startRadius;
      const startY = centerY + Math.sin(angle) * startRadius;

      const endX = centerX + Math.cos(angle) * endRadius;
      const endY = centerY + Math.sin(angle) * endRadius;

      particles.push({
        x: startX,
        y: startY,
        sx: startX,
        sy: startY,
        ex: endX,
        ey: endY,
        vx: randomBetween(-0.25, 0.25),
        vy: randomBetween(-0.25, 0.25),
        size: randomBetween(CONFIG.minSize, CONFIG.maxSize),
        alpha: randomBetween(0.22, 0.72),
        delay: Math.random() * 0.22,
        seed: Math.random() * Math.PI * 2,
      });
    }
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function drawOverlay(progress) {
    const fade = Math.max(0, 1 - progress * 0.88);

    ctx.fillStyle = `rgba(7, 8, 20, ${fade})`;
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.76
    );

    gradient.addColorStop(0, `rgba(255, 220, 245, ${0.13 * fade})`);
    gradient.addColorStop(0.4, `rgba(156, 132, 255, ${0.12 * fade})`);
    gradient.addColorStop(1, `rgba(7, 8, 20, ${fade})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawParticles(progress) {
    const centerX = width / 2;
    const centerY = height / 2;

    particles.forEach((p) => {
      const localProgress = Math.max(
        0,
        Math.min(1, (progress - p.delay) / (1 - p.delay))
      );

      const move = easeOutCubic(localProgress);

      p.x = p.sx + (p.ex - p.sx) * move + Math.sin(progress * 8 + p.seed) * 3;
      p.y = p.sy + (p.ey - p.sy) * move + Math.cos(progress * 8 + p.seed) * 3;

      const dx = p.x - centerX;
      const dy = p.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const distFade = Math.max(0.22, 1 - dist / (Math.max(width, height) * 0.75));

      const alpha =
        p.alpha *
        distFade *
        Math.max(0, 1 - progress * 0.92);

      const size = p.size * (1 + progress * 1.8);

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 245, 255, ${alpha})`;
      ctx.fill();
    });
  }

  function drawSoftLines(progress) {
    if (progress < 0.08 || progress > 0.78) return;

    const lineAlphaBase = Math.sin(progress * Math.PI) * 0.18;

    ctx.lineWidth = 0.6;

    for (let i = 0; i < particles.length; i += 3) {
      const a = particles[i];

      for (let j = i + 1; j < Math.min(i + 9, particles.length); j++) {
        const b = particles[j];

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 58) continue;

        const alpha = (1 - dist / 58) * lineAlphaBase;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(225, 220, 255, ${alpha})`;
        ctx.stroke();
      }
    }
  }

  function animate(now) {
    const elapsed = now - startTime;
    const rawProgress = Math.min(elapsed / CONFIG.duration, 1);
    const progress = easeInOutCubic(rawProgress);

    ctx.clearRect(0, 0, width, height);

    drawOverlay(rawProgress);
    drawSoftLines(progress);
    drawParticles(progress);

    if (elapsed > CONFIG.fadeOutDelay && !wrap.classList.contains("is-ending")) {
      wrap.classList.add("is-ending");
    }

    if (rawProgress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      wrap.classList.add("is-hidden");

      setTimeout(() => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }

        wrap.remove();
      }, CONFIG.removeDelay);
    }
  }

  function start() {
    resizeCanvas();
    createParticles();
    startTime = performance.now();
    animationFrame = requestAnimationFrame(animate);
  }

  let resizeTimer = null;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      resizeCanvas();
      createParticles();
    }, 160);
  });

  start();
});