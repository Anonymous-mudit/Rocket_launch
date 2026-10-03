/* ==========================================================================
   smoke.js — a small, bounded particle system for exhaust and steam.
   Particles live in "world" coordinates so the exhaust column stays
   behind on the ground and slides away as the camera climbs.
   Runs on requestAnimationFrame (via the GSAP ticker), never on scroll.
   ========================================================================== */
(function () {
  'use strict';

  class SmokeSystem {
    constructor(canvas, max = 340) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.max = max;
      this.p = [];
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.sprite = SmokeSystem.makeSprite();
      this.wasEmpty = true;
      this.resize();
    }

    /* A lumpy puff: several offset soft blobs read as billowing smoke */
    static makeSprite() {
      const s = 128;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d');
      for (let i = 0; i < 14; i++) {
        const x = s / 2 + (Math.random() - 0.5) * s * 0.36;
        const y = s / 2 + (Math.random() - 0.5) * s * 0.36;
        const r = s * (0.16 + Math.random() * 0.22);
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        const shade = 196 + Math.round(Math.random() * 40);
        grd.addColorStop(0, `rgba(${shade},${shade - 8},${shade + 4},0.24)`);
        grd.addColorStop(0.6, `rgba(${shade - 20},${shade - 28},${shade - 14},0.1)`);
        grd.addColorStop(1, 'rgba(170,160,176,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      return c;
    }

    resize() {
      this.w = this.canvas.clientWidth;
      this.h = this.canvas.clientHeight;
      this.canvas.width = Math.max(1, Math.round(this.w * this.dpr));
      this.canvas.height = Math.max(1, Math.round(this.h * this.dpr));
      this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    emit(x, y, o) {
      if (this.p.length >= this.max) return;
      this.p.push({
        x, y,
        vx: o.vx, vy: o.vy,
        r: o.r, gr: o.gr,
        life: 0, max: o.life,
        a: o.a
      });
    }

    /**
     * @param {number} dt      seconds since last frame
     * @param {number} worldY  current downward offset of the ground layer (px)
     * @param {number} u       viewport unit (px per 900px of height)
     */
    step(dt, worldY, u) {
      const { g, p } = this;
      if (!p.length) {
        if (!this.wasEmpty) { g.clearRect(0, 0, this.w, this.h); this.wasEmpty = true; }
        return;
      }
      this.wasEmpty = false;
      g.clearRect(0, 0, this.w, this.h);

      const drag = 1 - Math.min(1, 1.35 * dt);
      const lift = 6 * u * dt;

      for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
        q.life += dt;
        if (q.life >= q.max) { p[i] = p[p.length - 1]; p.pop(); continue; }

        q.vx *= drag;
        q.vy = q.vy * drag - lift;     // warm exhaust rises slowly
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.r += q.gr * dt;
        q.gr *= 1 - Math.min(1, 0.45 * dt);

        const sy = q.y + worldY;
        if (sy - q.r > this.h || sy + q.r < 0) continue;

        const t = q.life / q.max;
        const alpha = q.a * Math.min(1, t * 7) * (1 - t) * (1 - t * 0.4);
        if (alpha < 0.01) continue;
        g.globalAlpha = alpha;
        g.drawImage(this.sprite, q.x - q.r, sy - q.r, q.r * 2, q.r * 2);
      }
      g.globalAlpha = 1;
    }
  }

  window.SmokeSystem = SmokeSystem;
})();
