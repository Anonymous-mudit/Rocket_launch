/* ==========================================================================
   main.js — Welcome Itzfizz launch sequence

   How it works
   1. One GSAP timeline, scrubbed by ScrollTrigger, animates a plain
      state object `S` (thrust, altitude, camera position, ...).
      Scroll progress drives everything; nothing autoplays on scroll.
   2. A single render loop on the GSAP ticker (requestAnimationFrame)
      reads `S` and writes transforms/opacity. Scroll events themselves
      do no work, so there are no layout reads or reflows per scroll.
   3. The page-load intro is a separate, time-based timeline that only
      touches inner wrapper elements, so it can never fight the scroll
      timeline that drives their parents.
   ========================================================================== */
(() => {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     1. Split the headline into individually animated letters
     ------------------------------------------------------------------ */
  const headline = $('.headline');
  const words = headline.textContent.trim().split(/\s+/);
  headline.textContent = '';
  words.forEach((word) => {
    const w = document.createElement('span');
    w.className = 'word';
    w.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const c = document.createElement('span');
      c.className = 'char';
      const inner = document.createElement('span');
      inner.className = 'char__inner';
      inner.textContent = ch;
      c.appendChild(inner);
      w.appendChild(c);
    }
    headline.appendChild(w);
  });

  /* ------------------------------------------------------------------
     2. Element references
     ------------------------------------------------------------------ */
  const el = {
    scene: $('.scene'),
    cam: $('.cam'),
    heroCopy: $('.hero-copy'),
    motes: $('.motes'),
    beams: $$('.beam'),
    lights: $('.lights'),
    floatersFar: $('.floaters--far'),
    floatersMid: $('.floaters--mid'),
    station: $('.station'),
    payload: $('#payload'),
    skySpace: $('.sky--space'),
    stars: $('.stars'),
    earth: $('.earth'),
    cloudsFar: $('.clouds--far'),
    cloudsNear: $('.clouds--near'),
    world: $('.world'),
    padGlow: $('.pad-glow'),
    smokeGlow: $('.smoke-glow'),
    sun: $('.earth__sun'),
    smoke: $('.smoke'),
    rocket: $('.rocket-wrap'),
    engineGlow: $('.engine-glow'),
    flash: $('.flash'),
    lbTop: $('.letterbox--top'),
    lbBottom: $('.letterbox--bottom'),
    progress: $('.progress i'),
    clock: $('#hudClock'),
    alt: $('#hudAlt'),
    vel: $('#hudVel'),
    phases: $$('.hud__phases li'),
    // SVG parts
    stage1: $('#stage1'),
    s2body: $('#s2body'),
    flame1: $('#flame1'),
    flame2: $('#flame2'),
    fairingL: $('#fairingL'),
    fairingR: $('#fairingR'),
    panelL: $('#panelL'),
    panelR: $('#panelR'),
    arm: $('#crewArm')
  };
  const chars = $$('.char');
  const charInners = $$('.char__inner');
  const statsLeft = $$('.stat').slice(0, 2);
  const statsRight = $$('.stat').slice(2);

  /* ------------------------------------------------------------------
     3. Simulation state: the single source of truth for the scene
        (positions are fractions of the viewport height)
     ------------------------------------------------------------------ */
  const S = {
    vapor: 0.3,      // pre-launch venting
    arm: 0,          // crew access arm retraction
    thrust1: 0,      // booster engines
    thrust2: 0,      // upper-stage vacuum engine
    shake: 0,        // camera shake intensity
    rocketY: 0,      // rocket offset (fraction of H, negative = up)
    rocketRot: 0,    // gravity turn, degrees
    rocketScale: 1,  // camera zoom on the rocket
    worldY: 0,       // ground falls away (fraction of H)
    cloudsFar: -0.78,
    cloudsNear: -1.3,
    sky: 0,          // 0 = dawn sky, 1 = black space
    stars: 0.35,
    earthY: 0,       // 0 = hidden, 1 = Earth's limb in frame
    atmo: 1,         // air density, 1 at sea level
    glow: 0,         // flame light on the pad
    sep: 0,          // stage separation progress
    fairing: 0,      // fairing jettison progress
    s2away: 0,       // upper stage drifting away from the satellite
    panels: 0,       // solar array deployment
    clock: -10,      // mission clock, seconds
    alt: 0,          // km
    vel: 0,          // km/h
    letterbox: 0,
    flash: 0,
    dolly: 0,        // slow camera push-in before liftoff
    beamsIntro: 0,   // floodlights switched on by the intro
    beamsScroll: 1,  // ...and switched off by the scroll timeline
    motesIntro: 0,
    station: 0,      // space station crossing the frame
    floaters: 0      // orbital traffic fades in
  };

  /* Town lights between the ridges (avoid the pad in the middle) */
  for (let i = 0; i < 26; i++) {
    const dot = document.createElement('span');
    let x = rand(3, 97);
    if (x > 40 && x < 60) x += x < 50 ? -18 : 18;
    dot.style.left = x + '%';
    dot.style.bottom = rand(0, 70) + '%';
    dot.style.animationDelay = (-rand(0, 3.2)).toFixed(2) + 's';
    dot.style.opacity = rand(0.5, 1).toFixed(2);
    el.lights.appendChild(dot);
  }

  /* Depth planes */
  const layers = $$('.layer').map((node) => ({
    node,
    d: parseFloat(node.dataset.depth || '1'),
    sink: node.hasAttribute('data-sink'),
    x: gsap.quickSetter(node, 'x', 'px'),
    y: gsap.quickSetter(node, 'y', 'px'),
    sx: gsap.quickSetter(node, 'scaleX'),
    sy: gsap.quickSetter(node, 'scaleY')
  }));

  /* Orbital traffic: base position (fraction of W/H), drift, spin */
  const sats = [
    { node: $('.cubesat--a'), bx: 0.17, by: 0.33, spin: 7, ph: 0.4, rise: 0.35 },
    { node: $('.cubesat--b'), bx: 0.83, by: 0.74, spin: -11, ph: 2.1, rise: 0.5 },
    { node: $('.cubesat--c'), bx: 0.31, by: 0.8, spin: 15, ph: 4.2, rise: 0.25 }
  ];
  sats.forEach((o) => gsap.set(o.node, { xPercent: -50, yPercent: -50 }));
  gsap.set(el.station, { xPercent: -50 });

  /* ------------------------------------------------------------------
     4. Measurements (only on load / resize, never per scroll)
     ------------------------------------------------------------------ */
  const NOZZLE = 1070 / 1400;  // nozzle exit, as a fraction of the rocket box
  const ORIGIN = 0.10;         // transform origin: the payload, so zoom stays centred on it
  const motes = new Motes(el.motes, reduceMotion ? 30 : (window.innerWidth < 700 ? 45 : 80));
  const smoke = new SmokeSystem(el.smoke, reduceMotion ? 160 : (window.innerWidth < 700 ? 300 : 460));
  let W = 0, H = 0, u = 1, earthDrop = 0, originY = 0, nozzleDist = 0, padY = 0;
  let paintedW = 0, paintedH = 0;

  function measure() {
    W = el.cam.clientWidth;
    H = el.cam.clientHeight;
    u = H / 900;
    earthDrop = Math.min(W, H) * 0.4;   // matches the 40vmin offset in CSS
    const top = el.rocket.offsetTop;
    const rh = el.rocket.offsetHeight;
    originY = top + rh * ORIGIN;
    nozzleDist = rh * (NOZZLE - ORIGIN);
    padY = top + rh * NOZZLE;
    smoke.resize();
    motes.resize();
    if (W !== paintedW || Math.abs(H - paintedH) > 120) {
      Sky.drawStars(el.stars);
      Sky.drawClouds(el.cloudsFar, { clusters: 5, scale: 0.9, alpha: 0.75 });
      Sky.drawClouds(el.cloudsNear, { clusters: 4, scale: 1.25, alpha: 1 });
      paintedW = W; paintedH = H;
    }
  }

  gsap.set(el.rocket, { xPercent: -50, transformOrigin: `50% ${ORIGIN * 100}%` });
  measure();

  /* ------------------------------------------------------------------
     5. Page-load intro (time-based)
     ------------------------------------------------------------------ */
  function countUp() {
    $$('.stat__value').forEach((node, i) => {
      const target = Number(node.dataset.value);
      const o = { n: 0 };
      gsap.to(o, {
        n: target, duration: 1.6, delay: i * 0.14, ease: 'power2.out',
        onUpdate: () => { node.textContent = Math.round(o.n); }
      });
    });
  }

  const intro = gsap.timeline({ delay: 0.1 });
  intro
    .to('.veil', { opacity: 0, duration: 1.4, ease: 'power2.out' })
    .from(el.scene, { scale: 1.12, duration: 3, ease: 'power3.out' }, 0)
    // the landscape rises in depth order, far ridge first: a curtain going up
    .from('.mtn', { yPercent: 38, duration: 2.2, ease: 'power3.out', stagger: 0.18 }, 0.15)
    .from('.tower', { yPercent: 6, opacity: 0, duration: 1.8, ease: 'power3.out' }, 0.55)
    .from('.moon', { opacity: 0, scale: 0.7, duration: 2.2, ease: 'power2.out' }, 0.4)
    .from('.rays', { opacity: 0, duration: 2.5 }, 0.6)
    .to(S, { motesIntro: 1, duration: 2.5, ease: 'power1.out' }, 0.8)
    // floodlights strike with a flicker
    .to(S, { keyframes: { beamsIntro: [0, 0.85, 0.1, 0.6, 0.2, 1] }, duration: 1.1, ease: 'none' }, 1.3)
    .from('.topbar', { opacity: 0, y: -12, duration: 0.8, ease: 'power2.out' }, 0.5)
    .from('.eyebrow__inner', { opacity: 0, y: 12, duration: 0.9, ease: 'power2.out' }, 0.35)
    .from(charInners, { yPercent: 115, rotationX: -85, transformOrigin: '50% 100%', opacity: 0, duration: 1.2, ease: 'power4.out', stagger: 0.05 }, 0.5)
    .from('.stat__inner', { opacity: 0, y: 28, duration: 0.9, ease: 'power3.out', stagger: 0.16 }, 1.05)
    .add(countUp, 1.1)
    .from('.scroll-cue__inner', { opacity: 0, y: 8, duration: 0.8 }, 1.8);

  /* ------------------------------------------------------------------
     6. Scroll timeline (100 units = the whole flight)
     ------------------------------------------------------------------ */
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: () => '+=' + Math.round(window.innerHeight * 7),
      pin: true,
      scrub: reduceMotion ? true : 1.15,   // smoothing / interpolation of scroll
      anticipatePin: 1,
      invalidateOnRefresh: true
    }
  });

  // -- 0–10: the title card leaves, the theatre lights go down
  tl.to('.scroll-cue', { opacity: 0, y: 12, duration: 3 }, 0)
    .to('.eyebrow', { opacity: 0, y: -16, duration: 3, ease: 'power1.in' }, 0.4)
    .to(chars, { yPercent: -70, opacity: 0, duration: 4, ease: 'power2.in', stagger: { each: 0.3, from: 'center' } }, 0.6)
    .to(statsLeft, { x: -70, opacity: 0, duration: 4, ease: 'power2.in', stagger: 0.6 }, 1.2)
    .to(statsRight, { x: 70, opacity: 0, duration: 4, ease: 'power2.in', stagger: 0.6 }, 1.2)
    .to(S, { letterbox: 1, duration: 5, ease: 'power2.inOut' }, 3)
    .to('.hud', { opacity: 1, duration: 3 }, 5)
    .to(S, { arm: 1, duration: 5, ease: 'power1.inOut' }, 3)
    .to(S, { vapor: 1, duration: 6 }, 2);

  // camera pushes in while the title clears, then pulls back as the rocket climbs
  tl.to(S, { dolly: 1, duration: 16, ease: 'sine.inOut' }, 0)
    .to(S, { dolly: 0, duration: 14, ease: 'sine.inOut' }, 18)
    .to(S, { beamsScroll: 0, duration: 6 }, 16);

  // -- 5–15: countdown
  tl.to(S, { clock: 0, duration: 10 }, 5);
  $$('.countdown span').forEach((n, i) => {
    const t = 6 + i * 3;
    tl.fromTo(n, { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 1.1, ease: 'power2.out' }, t)
      .to(n, { opacity: 0, scale: 0.85, duration: 1.1, ease: 'power2.in' }, t + 1.7);
  });

  // -- 13–17: ignition
  tl.to(S, { thrust1: 1, glow: 1, duration: 4, ease: 'power2.out' }, 13)
    .to(S, { shake: 0.65, duration: 4, ease: 'power1.in' }, 13)
    .to(S, { vapor: 0, duration: 3 }, 14);

  // -- 17–30: liftoff, slow at first like a real heavy rocket
  tl.to(S, { rocketY: -0.18, duration: 13, ease: 'power2.in' }, 17)
    .to(S, { clock: 12, alt: 0.3, vel: 420, duration: 15, ease: 'power1.in' }, 15);

  // -- 26–56: ascent through the clouds into space
  tl.to(S, { worldY: 1.2, duration: 20, ease: 'power2.in' }, 26)
    .to(S, { cloudsFar: 1.35, duration: 22, ease: 'power1.in' }, 27)
    .to(S, { cloudsNear: 1.6, duration: 15, ease: 'power1.in' }, 31)
    .to(S, { glow: 0, duration: 10 }, 26)
    .to(S, { sky: 1, duration: 22, ease: 'power1.inOut' }, 34)
    .to(S, { stars: 1, duration: 22 }, 36)
    .to(S, { atmo: 0, duration: 26, ease: 'power1.in' }, 30)
    .to(S, { rocketRot: 14, duration: 30, ease: 'sine.inOut' }, 26)
    .to(S, { rocketScale: 0.82, duration: 30, ease: 'sine.inOut' }, 26)
    .to(S, { shake: 1, duration: 10, ease: 'sine.inOut' }, 30)      // building to Max-Q
    .to(S, { shake: 0.15, duration: 14, ease: 'sine.inOut' }, 41)
    .to(S, { clock: 162, alt: 78, vel: 8200, duration: 26, ease: 'power1.in' }, 30);

  // -- 55–59: main engine cutoff
  tl.to(S, { thrust1: 0, duration: 2.5, ease: 'power2.in' }, 55.5)
    .to(S, { shake: 0, duration: 2.5 }, 55.5);

  // -- 61–72: stage separation, upper stage ignition
  tl.to(S, { flash: 0.35, duration: 0.6, ease: 'power2.out' }, 61)
    .to(S, { flash: 0, duration: 1.6, ease: 'power2.in' }, 61.6)
    .to(S, { sep: 1, duration: 11, ease: 'power1.in' }, 61)
    .to(S, { thrust2: 1, duration: 3, ease: 'power2.out' }, 63.5)
    .to(S, { shake: 0.12, duration: 2 }, 63.5)
    .to(S, { shake: 0.04, duration: 6 }, 66)
    .to(S, { clock: 200, alt: 120, vel: 11000, duration: 11 }, 61);

  // -- 66–92: Earth rises into view, camera pushes in on the payload
  tl.to(S, { earthY: 1, duration: 16, ease: 'power2.out' }, 66)
    .to(S, { rocketRot: 6, duration: 24, ease: 'sine.inOut' }, 66)
    .to(S, { rocketScale: 2.7, rocketY: 0.01, duration: 18, ease: 'power2.inOut' }, 74);

  // -- 80–88: fairing jettison
  tl.to(S, { fairing: 1, duration: 8, ease: 'power1.out' }, 80);

  // -- 90–100: second-stage cutoff, payload separation, arrays deploy
  tl.to(S, { thrust2: 0, duration: 2.5, ease: 'power2.in' }, 90)
    .to(S, { shake: 0, duration: 2 }, 90)
    .to(S, { s2away: 1, duration: 8, ease: 'power1.in' }, 92)
    .to(S, { panels: 1, duration: 5, ease: 'power2.out' }, 94)
    .to(S, { clock: 536, alt: 210, vel: 27400, duration: 22 }, 72)
    .to(S, { letterbox: 0, duration: 4, ease: 'power2.inOut' }, 96)
    .to(S, { station: 1, duration: 18 }, 82)
    .to(S, { floaters: 1, duration: 10, ease: 'power2.out' }, 87);

  // -- phase captions
  const caption = (name, start, end) => {
    const node = $(`.caption[data-cap="${name}"]`);
    tl.fromTo(node, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 2, ease: 'power2.out' }, start);
    if (end) tl.to(node, { opacity: 0, y: -26, duration: 2, ease: 'power2.in' }, end - 2);
  };
  caption('liftoff', 18, 27);
  caption('maxq', 36, 45);
  caption('meco', 54, 61);
  caption('sep', 62, 71);
  caption('fairing', 80, 89);
  caption('orbit', 93, null);

  // keep the timeline exactly 100 units long
  tl.set({}, {}, 100);

  /* ------------------------------------------------------------------
     7. Render loop
     ------------------------------------------------------------------ */
  const qs = gsap.quickSetter;
  const set = {
    sceneX: qs(el.scene, 'x', 'px'),
    sceneY: qs(el.scene, 'y', 'px'),
    rocketY: qs(el.rocket, 'y', 'px'),
    rocketR: qs(el.rocket, 'rotation', 'deg'),
    rocketSX: qs(el.rocket, 'scaleX'),
    rocketSY: qs(el.rocket, 'scaleY'),
    worldY: qs(el.world, 'y', 'px'),
    smokeGlowY: qs(el.smokeGlow, 'y', 'px'),
    farY: qs(el.cloudsFar, 'y', 'px'),
    nearY: qs(el.cloudsNear, 'y', 'px'),
    earthY: qs(el.earth, 'y', 'px'),
    starsY: qs(el.stars, 'y', 'px'),
    lbTop: qs(el.lbTop, 'scaleY'),
    lbBottom: qs(el.lbBottom, 'scaleY'),
    progress: qs(el.progress, 'scaleY'),
    camX: qs(el.cam, 'x', 'px'),
    camY: qs(el.cam, 'y', 'px'),
    camSX: qs(el.cam, 'scaleX'),
    camSY: qs(el.cam, 'scaleY'),
    copyX: qs(el.heroCopy, 'x', 'px'),
    copyY: qs(el.heroCopy, 'y', 'px')
  };

  // only touch the DOM when a value actually changes
  const cache = new Map();
  const write = (key, value, fn) => {
    if (cache.get(key) === value) return;
    cache.set(key, value);
    fn(value);
  };
  const opacity = (node) => (v) => { node.style.opacity = v; };
  const attr = (node, name) => (v) => node.setAttribute(name, v);

  const phaseAt = [0.13, 0.17, 0.36, 0.555, 0.61, 0.8, 0.93];
  const pad2 = (n) => String(n).padStart(2, '0');

  function updateHud(progress) {
    const c = S.clock;
    const secs = c < 0 ? Math.ceil(-c) : Math.floor(c);
    const clock = `${c < 0 ? 'T−' : 'T+'}${pad2(Math.floor(secs / 3600))}:${pad2(Math.floor(secs / 60) % 60)}:${pad2(secs % 60)}`;
    write('clock', clock, (v) => { el.clock.textContent = v; });
    write('alt', S.alt.toFixed(1) + ' km', (v) => { el.alt.textContent = v; });
    write('vel', Math.round(S.vel / 10) * 10, (v) => { el.vel.textContent = v.toLocaleString('en-US') + ' km/h'; });

    let active = -1;
    for (let i = 0; i < phaseAt.length; i++) if (progress >= phaseAt[i]) active = i;
    write('phase', active, (a) => {
      el.phases.forEach((li, i) => {
        li.classList.toggle('is-done', i < a);
        li.classList.toggle('is-active', i === a);
      });
    });
  }

  const emitAcc = { vapor: 0, billow: 0, trail: 0 };
  let time = 0, prevClimb = 0, streamV = 0;
  const r2 = (v) => Math.round(v * 100) / 100;

  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };
  if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      pointer.active = true;
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.active = false; });
  }

  function runSmoke(dt) {
    const worldOff = S.worldY * H;
    const th = (S.rocketRot * Math.PI) / 180;
    const dist = nozzleDist * S.rocketScale;
    const nx = W / 2 - Math.sin(th) * dist;
    const ny = originY + S.rocketY * H + Math.cos(th) * dist - worldOff; // nozzle in world space
    const climb = padY - ny;
    const nearPad = Math.max(0, 1 - climb / (H * 0.45));

    // steam venting before ignition
    emitAcc.vapor += S.vapor * dt * 9;
    while (emitAcc.vapor >= 1) {
      emitAcc.vapor -= 1;
      const side = Math.random() < 0.5 ? -1 : 1;
      smoke.emit(W / 2 + side * rand(6, 34) * u, padY - rand(0, 40) * u, {
        vx: side * rand(4, 22) * u, vy: -rand(6, 22) * u,
        r: rand(6, 12) * u, gr: rand(8, 18) * u, life: rand(2.4, 4), a: 0.4
      });
    }

    // ground billows pushed sideways out of the flame trench
    emitAcc.billow += S.thrust1 * nearPad * dt * 72;
    while (emitAcc.billow >= 1) {
      emitAcc.billow -= 1;
      const side = Math.random() < 0.5 ? -1 : 1;
      if (Math.random() < 0.22) {            // some smoke climbs straight up the column
        smoke.emit(W / 2 + rand(-30, 30) * u, padY - rand(0, 20) * u, {
          vx: rand(-30, 30) * u, vy: -rand(50, 140) * u,
          r: rand(16, 28) * u, gr: rand(30, 60) * u, life: rand(3, 5.5), a: rand(0.35, 0.6)
        });
        continue;
      }
      smoke.emit(W / 2 + side * rand(0, 34) * u, padY - rand(0, 26) * u, {
        vx: side * rand(40, 300) * u, vy: -rand(4, 60) * u,
        r: rand(18, 36) * u, gr: rand(26, 70) * u, life: rand(3, 6.5), a: rand(0.45, 0.75)
      });
    }

    // exhaust column left behind in the atmosphere
    emitAcc.trail += S.thrust1 * S.atmo * (1 - nearPad * 0.6) * dt * 34;
    while (emitAcc.trail >= 1) {
      emitAcc.trail -= 1;
      smoke.emit(nx + rand(-4, 4) * u, ny + rand(0, 24) * u, {
        vx: rand(-10, 10) * u, vy: rand(4, 30) * u,
        r: rand(6, 11) * u * (0.5 + S.atmo * 0.5), gr: rand(10, 24) * u,
        life: rand(2.6, 4.6), a: 0.6 * S.atmo
      });
    }

    smoke.step(dt, worldOff, u);
  }

  function render(_t, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    time += dt;

    // camera shake (two incommensurate sines = organic, not jittery)
    const sh = reduceMotion ? 0 : S.shake;
    const sx = sh > 0.002 ? Math.sin(time * 47.3) * Math.sin(time * 13.1) * sh * 5 * u : 0;
    const sy = sh > 0.002 ? Math.sin(time * 39.7 + 1.3) * Math.cos(time * 17.9) * sh * 4 * u : 0;
    write('sx', sx, set.sceneX);
    write('sy', sy, set.sceneY);

    // camera rig: follow the pointer on desktop, breathe slowly everywhere else
    if (!pointer.active) {
      pointer.tx = reduceMotion ? 0 : Math.sin(time * 0.21) * 0.45;
      pointer.ty = reduceMotion ? 0 : Math.sin(time * 0.15 + 1) * 0.3;
    }
    const ease = 1 - Math.exp(-dt * 2.4);
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;
    const camX = -pointer.x * 24 * u;
    const camY = -pointer.y * 10 * u;
    const camS = 1.05 + S.dolly * 0.08;
    set.camX(r2(camX)); set.camY(r2(camY)); set.camSX(camS); set.camSY(camS);
    set.copyX(r2(camX * 1.7)); set.copyY(r2(camY * 1.4));

    // each depth plane is held back against the camera by (1 - depth)
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const back = 1 - L.d;
      const sc = (1 + (camS - 1) * L.d) / camS;
      const y = -camY * back + (L.sink ? -back * S.worldY * H * 0.55 : 0);
      L.x(r2(-camX * back)); L.y(r2(y)); L.sx(sc); L.sy(sc);
    }

    // camera + world
    write('ry', S.rocketY * H, set.rocketY);
    write('rr', S.rocketRot, set.rocketR);
    write('rs', S.rocketScale, (v) => { set.rocketSX(v); set.rocketSY(v); });
    write('wy', S.worldY * H, (v) => { set.worldY(v); set.smokeGlowY(v); });
    write('cf', S.cloudsFar * H, set.farY);
    write('cn', S.cloudsNear * H, set.nearY);
    write('ey', -S.earthY * (H * 0.34 + earthDrop), set.earthY);
    write('sun', +S.earthY.toFixed(3), opacity(el.sun));
    write('st', -S.sky * H * 0.06, set.starsY);
    write('sky', S.sky, opacity(el.skySpace));
    write('stars', S.stars, opacity(el.stars));
    write('lb', S.letterbox, (v) => { set.lbTop(v); set.lbBottom(v); });
    write('flash', S.flash, opacity(el.flash));

    // flames: flicker, and the plume widens as the air thins
    const flick = reduceMotion ? 1 : 0.9 + 0.06 * Math.sin(time * 61) + 0.04 * Math.sin(time * 97 + 0.7);
    const vac = 1 - S.atmo;
    if (S.thrust1 > 0.002) {
      const fx = (0.75 + 0.25 * S.thrust1) * (1 + vac * 1.7);
      const fy = S.thrust1 * flick * (1 + vac * 0.3);
      el.flame1.setAttribute('transform', `translate(60 1068) scale(${fx.toFixed(3)} ${fy.toFixed(3)}) translate(-60 -1068)`);
      write('f1o', +(Math.min(1, S.thrust1 * 1.5) * (1 - vac * 0.35)).toFixed(3), attr(el.flame1, 'opacity'));
    } else {
      write('f1o', 0, attr(el.flame1, 'opacity'));
    }
    if (S.thrust2 > 0.002) {
      const fx = 1.2 + 0.4 * S.thrust2;
      const fy = S.thrust2 * (0.94 + 0.06 * flick);
      el.flame2.setAttribute('transform', `translate(60 530) scale(${fx.toFixed(3)} ${fy.toFixed(3)}) translate(-60 -530)`);
      write('f2o', +Math.min(1, S.thrust2 * 1.4).toFixed(3), attr(el.flame2, 'opacity'));
    } else {
      write('f2o', 0, attr(el.flame2, 'opacity'));
    }
    write('eg', +(S.thrust1 * (0.8 + 0.2 * flick) * (1 - vac * 0.5)).toFixed(3), opacity(el.engineGlow));
    write('pg', +(S.glow * (0.85 + 0.15 * flick)).toFixed(3), (v) => { el.padGlow.style.opacity = v; el.smokeGlow.style.opacity = v; });

    // crew arm swings away
    write('arm', S.arm, (a) => el.arm.setAttribute('transform', `translate(90 0) scale(${(1 - a * 0.72).toFixed(3)} 1) translate(-90 0)`));

    // stage separation: booster drops back and tumbles
    write('sep', S.sep, (s) => {
      el.stage1.setAttribute('transform', `translate(${(-s * 40).toFixed(1)} ${(s * s * 950 + s * 40).toFixed(1)}) rotate(${(-s * 18).toFixed(2)} 60 760)`);
      el.stage1.setAttribute('opacity', Math.max(0, 1 - Math.max(0, (s - 0.55) / 0.45)).toFixed(3));
    });

    // fairing halves peel away
    write('fair', S.fairing, (f) => {
      const o = Math.max(0, 1 - Math.max(0, (f - 0.5) / 0.5)).toFixed(3);
      el.fairingL.setAttribute('transform', `translate(${(-f * 120).toFixed(1)} ${(-f * 30).toFixed(1)}) rotate(${(-f * 48).toFixed(2)} 28 231)`);
      el.fairingR.setAttribute('transform', `translate(${(f * 120).toFixed(1)} ${(-f * 30).toFixed(1)}) rotate(${(f * 48).toFixed(2)} 92 231)`);
      el.fairingL.setAttribute('opacity', o);
      el.fairingR.setAttribute('opacity', o);
    });

    // upper stage drifts off, satellite unfolds its arrays
    write('s2', S.s2away, (s) => {
      el.s2body.setAttribute('transform', `translate(${(s * 30).toFixed(1)} ${(s * 420).toFixed(1)}) rotate(${(s * 28).toFixed(2)} 60 380)`);
      el.s2body.setAttribute('opacity', (1 - Math.max(0, (s - 0.4) / 0.6)).toFixed(3));
    });
    write('pan', S.panels, (p) => {
      const k = Math.max(0.0001, p).toFixed(3);
      el.panelL.setAttribute('transform', `translate(42 0) scale(${k} 1) translate(-42 0)`);
      el.panelR.setAttribute('transform', `translate(78 0) scale(${k} 1) translate(-78 0)`);
    });

    // the deployed satellite floats: a slow bob and roll
    if (S.panels > 0.001 && !reduceMotion) {
      const k = S.panels;
      const bob = Math.sin(time * 0.8) * 3.5 * k;
      const roll = Math.sin(time * 0.45) * 3 * k;
      el.payload.setAttribute('transform', `translate(0 ${bob.toFixed(2)}) rotate(${roll.toFixed(2)} 60 150)`);
    } else if (cache.get('payIdle') !== 0) {
      el.payload.removeAttribute('transform');
    }
    cache.set('payIdle', S.panels > 0.001 ? 1 : 0);

    // floodlights
    const beam = +(S.beamsIntro * S.beamsScroll * (0.94 + 0.06 * flick)).toFixed(3);
    write('beam', beam, (v) => el.beams.forEach((b) => { b.style.opacity = v; }));

    // orbital traffic
    const fl = S.floaters;
    const stationOn = S.station > 0.001;
    write('flV', fl > 0.001 || stationOn ? 1 : 0, (v) => {
      const vis = v ? 'visible' : 'hidden';
      el.floatersFar.style.visibility = vis;
      el.floatersMid.style.visibility = vis;
    });
    if (fl > 0.001 || stationOn) {
      el.floatersFar.style.opacity = Math.max(fl, Math.min(1, S.station * 4));
      el.floatersMid.style.opacity = fl;
      gsap.set(el.station, {
        x: W * (1.1 - 0.36 * S.station),
        y: Math.sin(time * 0.3) * 4 * u,
        rotation: -5 + Math.sin(time * 0.2) * 1.2
      });
      sats.forEach((o) => {
        gsap.set(o.node, {
          x: o.bx * W + Math.sin(time * 0.35 + o.ph) * 10 * u,
          y: o.by * H + (1 - fl) * H * o.rise + Math.cos(time * 0.42 + o.ph) * 7 * u,
          rotation: o.ph * 40 + time * o.spin
        });
      });
    }

    const progress = tl.progress();
    write('prog', +progress.toFixed(4), set.progress);
    updateHud(progress);

    runSmoke(dt);

    // dust / ice motes, streaking when the camera climbs fast
    const climb = S.worldY * H + S.alt * 5 * u;
    const v = Math.max(-5000, Math.min(5000, (climb - prevClimb) / Math.max(dt, 0.001)));
    prevClimb = climb;
    streamV += (v - streamV) * Math.min(1, dt * 5);
    motes.step(dt, { alpha: S.motesIntro * 0.85, cold: S.sky, stream: streamV, px: camX, py: camY, u });
  }

  gsap.ticker.add(render);

  /* ------------------------------------------------------------------
     8. Section below the hero: one gentle reveal per block
     ------------------------------------------------------------------ */
  if (!reduceMotion) {
    gsap.set('.reveal', { opacity: 0, y: 36 });
    ScrollTrigger.batch('.reveal', {
      start: 'top 86%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12 })
    });
  }

  // "Watch the launch again" / brand link: smooth return to the top
  $$('a[href="#hero"]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }));

  /* ------------------------------------------------------------------
     9. Resize + font loading
     ------------------------------------------------------------------ */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  });
  ScrollTrigger.addEventListener('refresh', measure);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
})();
