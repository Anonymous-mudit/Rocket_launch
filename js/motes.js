/* ==========================================================================
   motes.js — floating specks with individual depth (z).
   On the ground they read as dust in the floodlights; in the climb they
   stream past the camera; in orbit they become cold glints of ice.
   Near motes move more than far ones, which is what sells the depth.
   ========================================================================== */
(function () {
  'use strict';

  function dot(rgb) {
    const s = 32;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, `rgba(${rgb},1)`);
    grd.addColorStop(0.25, `rgba(${rgb},0.6)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    return c;
  }

  class Motes {
    constructor(canvas, count) {
      this.c = canvas;
      this.g = canvas.getContext('2d');
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.warm = dot('255,206,160');
      this.cool = dot('200,216,255');
      this.t = 0;
      this.p = Array.from({ length: count }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: 0.12 + Math.pow(Math.random(), 1.7) * 0.88,   // mostly far, a few close
        vx: (Math.random() - 0.5) * 0.02,
        vy: -(0.004 + Math.random() * 0.012),
        ph: Math.random() * Math.PI * 2,
        tw: 0.6 + Math.random() * 1.8
      }));
      this.resize();
    }

    resize() {
      this.w = this.c.clientWidth;
      this.h = this.c.clientHeight;
      this.c.width = Math.max(1, Math.round(this.w * this.dpr));
      this.c.height = Math.max(1, Math.round(this.h * this.dpr));
      this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    /**
     * o.alpha   overall visibility
     * o.cold    0 = warm dust, 1 = cold space glints
     * o.stream  vertical camera speed in px/s (positive = camera climbing)
     * o.px/py   camera parallax offset in px
     * o.u       viewport unit
     */
    step(dt, o) {
      const { g, w, h } = this;
      g.clearRect(0, 0, w, h);
      if (o.alpha < 0.01) return;
      this.t += dt;

      const streak = Math.min(7, Math.abs(o.stream) / 380);
      for (const p of this.p) {
        p.x += p.vx * p.z * dt;
        p.y += p.vy * p.z * dt + (o.stream * p.z * p.z * dt) / h;
        if (p.x < -0.05) p.x += 1.1; else if (p.x > 1.05) p.x -= 1.1;
        if (p.y < -0.05) p.y += 1.1; else if (p.y > 1.05) p.y -= 1.1;

        const sx = p.x * w + o.px * (p.z - 0.35) * 1.6;
        const sy = p.y * h + o.py * (p.z - 0.35) * 1.6;
        const r = (0.7 + p.z * 2.6) * o.u;
        const tw = 0.55 + 0.45 * Math.sin(this.t * p.tw + p.ph);
        const a = o.alpha * (0.2 + 0.8 * p.z) * tw;
        const len = r * 2 * (1 + streak * p.z);

        if (o.cold < 0.99) {
          g.globalAlpha = a * (1 - o.cold);
          g.drawImage(this.warm, sx - r, sy - len / 2, r * 2, len);
        }
        if (o.cold > 0.01) {
          g.globalAlpha = a * o.cold;
          g.drawImage(this.cool, sx - r, sy - len / 2, r * 2, len);
        }
      }
      g.globalAlpha = 1;
    }
  }

  window.Motes = Motes;
})();
