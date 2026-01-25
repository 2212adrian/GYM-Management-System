(() => {
  const canvas = document.getElementById('starCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });

  let width, height, dpr;
  const stars = [];

  const INITIAL_STARS = 50; // slightly fewer
  const MAX_STARS = 80;
  const SPAWN_INTERVAL = 20;
  const MAX_DPR = 1.5;
  const WARP_SPAWN_DURATION = 2000; // spawn for 2s during warp

  let spawningEnabled = true;
  let lastSpawn = 0;

  let warpPhase = 0;
  let warpStart = 0;
  const WARP_DURATION = 1500;

  // Easing functions
  const easeOutBack = (t) => {
    const c1 = 1.70158;
    return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const easeInExpo = (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1)));

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.style.position = 'fixed';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.zIndex = 3;
    canvas.style.pointerEvents = 'none';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    document.body.style.overflow = 'hidden';
  }

  function createStar(randomX = true) {
    let newY;
    let tries = 0;
    do {
      newY = Math.random() * height;
      tries++;
      // avoid stars too close vertically to others
    } while (stars.some((s) => Math.abs(s.y - newY) < 15) && tries < 5);

    return {
      x: randomX ? Math.random() * width : -Math.random() * 50,
      y: newY,
      r: Math.random() * 1 + 0.5, // thin needle
      baseSpeed: Math.random() * 0.3 + 0.15,
      glow: 0,
    };
  }

  function populateInitialStars() {
    stars.length = 0;
    for (let i = 0; i < INITIAL_STARS; i++) {
      stars.push(createStar(true));
    }
  }

  function spawnStar(time) {
    // allow spawning if enabled OR during first 2s of warp
    const warpSpawning =
      warpPhase === 1 && time - warpStart < WARP_SPAWN_DURATION;
    if (!spawningEnabled && !warpSpawning) return;
    if (stars.length >= MAX_STARS) return;
    if (time - lastSpawn < SPAWN_INTERVAL) return;

    stars.push(createStar(false));
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
      glowBoost = Math.min(1, t * 1.2); // reduce glow for performance
    }

    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      const vx = warpPhase === 1 ? speedBoost : s.baseSpeed;
      const vy = 0;

      s.x += vx;
      s.y += vy;

      // recycle stars beyond right edge
      if (s.x > width + 50) {
        if (spawningEnabled) {
          stars[i] = createStar(false);
        } else if (warpPhase === 1) {
          stars.splice(i, 1);
        }
        continue;
      }

      const trail = Math.min(100, Math.abs(vx) * 4); // long for warp, thin needle
      s.glow = glowBoost;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - trail, s.y);

      ctx.strokeStyle = `rgba(255,255,255,${0.5 + s.glow})`;
      ctx.lineWidth = s.r;
      ctx.shadowBlur = warpPhase === 1 ? s.glow * 12 : 0;
      ctx.shadowColor = '#ffffff';
      ctx.stroke();
    }

    requestAnimationFrame(update);
  }

  // Init
  resize();
  populateInitialStars();
  requestAnimationFrame(update);
  window.addEventListener('resize', resize);

  // Trigger warp
  window.triggerStarWarp = () => {
    if (warpPhase !== 0) return;
    spawningEnabled = false;
    warpPhase = 1;
    warpStart = performance.now();
  };
})();
