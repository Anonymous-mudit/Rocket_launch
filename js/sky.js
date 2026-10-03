/* ==========================================================================
   sky.js — static layers painted once (and again on resize):
   a starfield with a faint galactic band, and two cumulus cloud decks.
   They are moved later with transforms only, never repainted on scroll.
   ========================================================================== */
(function () {
  'use strict';

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const rand = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  function fit(canvas) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * DPR));
    canvas.height = Math.max(1, Math.round(h * DPR));
    const g = canvas.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }

  function puff(size, rgb, core) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(${rgb},${core})`);
    grd.addColorStop(0.45, `rgba(${rgb},${core * 0.55})`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function drawStars(canvas) {
    const { g, w, h } = fit(canvas);

    // faint galactic band running diagonally
    const haze = puff(128, '190,200,255', 0.022);
    for (let i = 0; i < 160; i++) {
      const t = Math.random();
      const x = t * w + gauss() * w * 0.05;
      const y = h * 0.62 - t * h * 0.5 + gauss() * h * 0.06;
      const s = rand(0.06, 0.16) * Math.max(w, h);
      g.drawImage(haze, x - s / 2, y - s / 2, s, s);
    }

    const tints = ['255,255,255', '255,255,255', '206,222,255', '255,236,214'];
    const count = Math.round((w * h) / 2300);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const big = Math.random() > 0.94;
      const r = big ? rand(0.9, 1.6) : rand(0.3, 0.85);
      const a = big ? rand(0.7, 1) : rand(0.2, 0.85);
      const tint = tints[(Math.random() * tints.length) | 0];
      if (big) {
        const glow = g.createRadialGradient(x, y, 0, x, y, r * 5);
        glow.addColorStop(0, `rgba(${tint},${a * 0.35})`);
        glow.addColorStop(1, `rgba(${tint},0)`);
        g.fillStyle = glow;
        g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      }
      g.fillStyle = `rgba(${tint},${a})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  /**
   * Cumulus decks lit by a low dawn sun: warm tops, violet undersides.
   * opts.clusters  number of cloud banks
   * opts.scale     puff size multiplier
   * opts.alpha     overall density
   */
  function drawClouds(canvas, opts) {
    const { g, w, h } = fit(canvas);
    const lit = puff(128, '255,222,206', 1);
    const shade = puff(128, '110,92,132', 1);
    const base = Math.min(w, h);

    for (let k = 0; k < opts.clusters; k++) {
      const cx = rand(-0.1, 1.1) * w;
      const cy = rand(0.12, 0.88) * h;
      const cw = rand(0.35, 0.75) * Math.max(w, base * 1.2);
      const puffs = 26 + ((Math.random() * 18) | 0);
      for (let j = 0; j < puffs; j++) {
        const px = cx + gauss() * cw * 0.5;
        const py = cy + gauss() * cw * 0.07;
        const s = rand(0.07, 0.17) * cw * opts.scale;
        g.globalAlpha = 0.5 * opts.alpha;
        g.drawImage(shade, px - s / 2, py - s / 2 + s * 0.22, s, s);
        g.globalAlpha = 0.42 * opts.alpha;
        g.drawImage(lit, px - s / 2, py - s / 2 - s * 0.08, s * 0.92, s * 0.92);
      }
    }
    g.globalAlpha = 1;
  }

  window.Sky = { drawStars, drawClouds };
})();
