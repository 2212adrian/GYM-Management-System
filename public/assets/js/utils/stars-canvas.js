(() => {
  const canvas = document.getElementById('starCanvas');
  const container = document.getElementById('starContainer');
  if (!canvas || !container) return;

  const ctx = canvas.getContext('2d', { alpha: true });

  let width, height, dpr;
  const stars = [];

  // ===== PERFORMANCE TUNING =====
  const INITIAL_STARS = 60; // fewer, bigger stars
  const MAX_STARS = 100;
  const SPAWN_INTERVAL = 20;
  const MAX_DPR = 1.5;

  let spawningEnabled = true; // only disable after warp
  let lastSpawn = 0;

  let warpPhase = 0;
  let warpStart = 0;
  const WARP_DURATION = 1500;

  const easeOutBack = (t) => {
    const c1 = 1.70158;
    return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const easeInExpo = (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1)));

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = container.clientWidth;
    height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    document.body.style.overflow = 'hidden';
  }

  function createStar(randomX = true) {
    return {
      x: randomX ? Math.random() * width : -Math.random() * 50,
      y: Math.random() * height,
      r: Math.random() * 2.5 + 1.5,
      baseSpeed: Math.random() * 0.3 + 0.15,
      angle: Math.random() * 0.25 - 0.125,
      glow: 0,
    };
  }

  function populateInitialStars() {
    stars.length = 0;
    for (let i = 0; i < INITIAL_STARS; i++) {
      stars.push(createStar(true)); // random across container
    }
  }

  function spawnStar(time) {
    if (!spawningEnabled) return;
    if (stars.length >= MAX_STARS) return;
    if (time - lastSpawn < SPAWN_INTERVAL) return;

    stars.push(createStar(false)); // spawn slightly off-left
    lastSpawn = time;
  }

  function update(time) {
    ctx.clearRect(0, 0, width, height);

    spawnStar(time);

    let speedBoost = 0;
    let glowBoost = 0;

    if (warpPhase === 1) {
      const t = Math.min((time - warpStart) / WARP_DURATION, 1);
      const pull = easeOutBack(Math.min(t * 1.1, 1)) * -3;
      const launch = easeInExpo(t) * 45;

      speedBoost = pull + launch;
      glowBoost = Math.min(1.2, t * 1.5);
    }

    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      const vx = warpPhase === 1 ? speedBoost : s.baseSpeed;
      const vy = vx * s.angle;

      s.x += vx;
      s.y += vy;

      // recycle stars beyond right edge
      if (s.x > width + 50 || s.y < -50 || s.y > height + 50) {
        if (spawningEnabled) {
          stars[i] = createStar(false); // respawn left
        } else if (warpPhase === 1) {
          stars.splice(i, 1);
        }
        continue;
      }

      const trail = Math.min(60, Math.abs(vx) * 2.2);
      s.glow = glowBoost;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - trail, s.y - vy * 0.3);

      ctx.strokeStyle = `rgba(255,255,255,${0.55 + s.glow})`;
      ctx.lineWidth = s.r + s.glow;

      ctx.shadowBlur = warpPhase === 1 ? s.glow * 16 : 0;
      ctx.shadowColor = '#ffffff';

      ctx.stroke();
    }

    requestAnimationFrame(update);
  }

  resize();
  populateInitialStars();
  requestAnimationFrame(update);
  window.addEventListener('resize', resize);

  window.triggerStarWarp = () => {
    if (warpPhase !== 0) return;
    spawningEnabled = false; // stop spawning new stars
    warpPhase = 1;
    warpStart = performance.now();
  };
})();
