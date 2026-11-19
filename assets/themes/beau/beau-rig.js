/* ═══════════════════════════════════════════════════════════════
   BEAU-RIG.JS — Beau spielt mit einem Schmetterling, live animiert

   Statt fertiger Videobilder bewegt dieses Skript die gemalten Einzelteile
   aus assets/themes/beau/rig/ (erzeugt von scripts/rig-beau.py) mit 60 fps:
   Blick folgt dem Schmetterling (jedes Auge einzeln → schielt, wenn er nah
   ist), Kopf neigt und dreht sich mit, Schwanz schwingt weich, Atmen,
   Blinzeln. Der Schmetterling landet einmal pro Runde auf der Hutkrempe.

   Einbinden (klassisches Script, kein Modul — läuft unter file://):
     <script src="assets/themes/beau/rig/rig-layout.js"></script>
     <script src="assets/themes/beau/beau-rig.js"></script>
     const beau = BeauRig.mount(element, { base: 'assets/themes/beau/rig/' });
     beau.destroy();
   Optionen: speed (1 = normal), still (true = Standbild, z.B. reduzierte Bewegung),
   version (hängt ?v=… an die Bild-URLs, gegen veraltete Caches).
   Das Element bestimmt die Größe (quadratisch, Breite = Elementbreite).

   Farben: Das einzige Literal hier (Lidlinie) gehört zur
   Illustration selbst — wie die Bildpixel, nicht zum Theme.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const STAGE = 512;                 // logische Bühne (wie die alten Videos)
  const CAT_S = 0.48;                // Rohpixel → Bühnenpixel
  const SRC_C = [523.5, 909];        // Mitte/Unterkante des Motivs im Rohbild
  const DST_C = [256, 492];          // … auf der Bühne
  const LOOP = 20;                   // Sekunden je Runde
  const FLY_SPAN = 58;               // Spannweite Schmetterling (Bühnenpixel)

  const toSrc = (x, y) => [(x - DST_C[0]) / CAT_S + SRC_C[0], (y - DST_C[1]) / CAT_S + SRC_C[1]];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rad = (d) => d * Math.PI / 180;

  /* ── Flugbahn (Sekunde, x, y) auf der Bühne; LAND = sitzt auf der Krempe ── */
  const LAND_SRC = [770, 436];       // Landepunkt auf der Krempe (Kopf-Koordinaten, Rohbild)
  const LAND_T = [9.8, 12.8];
  const LAND_STAGE = [(LAND_SRC[0] - SRC_C[0]) * CAT_S + DST_C[0], (LAND_SRC[1] - SRC_C[1]) * CAT_S + DST_C[1] - 8];
  const FLIGHT = [
    [0, 62, 400], [1.5, 84, 326], [2.8, 52, 222], [4.0, 112, 122], [5.0, 205, 62], [6.0, 322, 72],
    [7.0, 440, 160], [7.8, 470, 292], [8.6, 432, 384], [9.2, 412, 330],
    [LAND_T[0], LAND_STAGE[0], LAND_STAGE[1]], [LAND_T[1], LAND_STAGE[0], LAND_STAGE[1]],
    [13.5, 318, 236], [14.2, 246, 318], [14.9, 190, 300], [15.9, 112, 360], [17.2, 72, 436], [18.6, 40, 428],
  ];
  const BLINKS = [2.1, 6.4, 8.95, 15.3, 18.7];

  function flightPos(t) {
    const n = FLIGHT.length;
    const pt = (i) => { const k = ((i % n) + n) % n, w = Math.floor(i / n); return [FLIGHT[k][0] + w * LOOP, FLIGHT[k][1], FLIGHT[k][2]]; };
    let i = 0;
    for (let k = 0; k < n; k++) if (FLIGHT[k][0] <= t) i = k;
    const p0 = pt(i), p1 = pt(i + 1), pm = pt(i - 1), pp = pt(i + 2);
    const dt = p1[0] - p0[0], u = (t - p0[0]) / dt;
    const out = [0, 0];
    for (let j = 1; j <= 2; j++) {
      const m0 = (p1[j] - pm[j]) / (p1[0] - pm[0]), m1 = (pp[j] - p0[j]) / (pp[0] - p0[0]);
      const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
      out[j - 1] = h00 * p0[j] + h10 * dt * m0 + h01 * p1[j] + h11 * dt * m1;
    }
    return out;
  }

  /* kritisch gedämpfte Feder: weiches Nachziehen ohne Überschwingen */
  function spring(s, target, omega, dt) {
    for (let j = 0; j < 2; j++) {
      const x = s.p[j] - target[j];
      const e = Math.exp(-omega * dt);
      const v = s.v[j];
      s.p[j] = target[j] + (x + (v + omega * x) * dt) * e;
      s.v[j] = (v - omega * (v + omega * x) * dt) * e;
    }
  }

  function loadImages(base, names, version) {
    return Promise.all(names.map((n) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res([n, im]);
      im.onerror = () => rej(new Error('Beau-Rig: Bild fehlt: ' + n));
      im.src = base + n + '.png' + (version ? '?v=' + encodeURIComponent(version) : '');
    }))).then((list) => Object.fromEntries(list));
  }

  function mount(el, opts) {
    opts = opts || {};
    const L = window.BEAU_RIG_LAYOUT;
    if (!L) throw new Error('Beau-Rig: rig-layout.js nicht geladen');
    const base = opts.base || 'assets/themes/beau/rig/';
    let speed = opts.speed == null ? 1 : opts.speed;
    const still = !!opts.still;

    const canvas = document.createElement('canvas');
    canvas.className = 'beau-rig';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', opts.label || 'Beau, eine schwarze Katze mit Hexenhut, beobachtet einen Schmetterling');
    canvas.style.cssText = 'display:block;width:100%;aspect-ratio:1/1;';
    el.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const eyeCv = {};
    for (const s of ['l', 'r']) {
      const r = L.layers['iris_' + s].rect;
      const c = document.createElement('canvas');
      c.width = r[2]; c.height = r[3];
      eyeCv[s] = c;
    }

    const names = [...Object.keys(L.layers), ...Object.keys(L.butterfly.parts)];
    let img = null, raf = 0, alive = true, last = 0, clock = 0, visible = true;
    const headCenter = L.layers.features.center;
    const gazeEye = { p: [headCenter[0], headCenter[1] + 200], v: [0, 0] };
    const gazeHead = { p: [headCenter[0], headCenter[1] + 200], v: [0, 0] };

    function resize() {
      const w = Math.max(1, Math.round(canvas.clientWidth * (window.devicePixelRatio || 1)));
      if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
    }

    /* ── Zustand zur Zeit t ── */
    function pose(t, dt) {
      const tl = ((t % LOOP) + LOOP) % LOOP;
      const breath = Math.sin(2 * Math.PI * t / 4);

      // Kopf (vorläufig mit Blick aus dem letzten Frame, für den Landepunkt)
      const hv = [gazeHead.p[0] - headCenter[0], gazeHead.p[1] - headCenter[1]];
      const hl = Math.hypot(hv[0], hv[1]);
      const hn = [hv[0] / (hl + 170), hv[1] / (hl + 170)];
      const head = {
        roll: rad(hn[0] * 5.5 - hn[1] * hn[0] * 2),
        tx: hn[0] * 6, ty: hn[1] * 4 - breath * 2.2,
        fx: hn[0] * 10, fy: hn[1] * 6,
      };

      // Schmetterling
      let [bx, by] = flightPos(tl);
      const landW = smooth(LAND_T[0] - 0.7, LAND_T[0], tl) * (1 - smooth(LAND_T[1], LAND_T[1] + 0.35, tl));
      const wob = 1 - landW;
      bx += wob * (Math.sin(2 * Math.PI * t / 3) * 3);
      by += wob * (Math.sin(2 * Math.PI * t / 1.5) * 4 + Math.sin(2 * Math.PI * t / 0.75 + 1) * 2);
      // gelandet: hängt am Kopf (Krempe bewegt sich mit)
      const lp = headPoint(head, LAND_SRC[0], LAND_SRC[1]);
      const lst = [(lp[0] - SRC_C[0]) * CAT_S + DST_C[0], (lp[1] - SRC_C[1]) * CAT_S + DST_C[1] - 8];
      bx += (lst[0] - LAND_STAGE[0]) * landW;
      by += (lst[1] - LAND_STAGE[1]) * landW;
      const [ax] = flightPos(tl - 0.05), [cx2] = flightPos(tl + 0.05);
      const tilt = clamp((cx2 - ax) * 1.3, -24, 24) * wob + (head.roll * 180 / Math.PI + 8) * landW;
      const fast = 0.16 + 0.84 * Math.abs(Math.cos(Math.PI * 6.5 * t));
      const slowPh = 0.5 + 0.5 * Math.cos(2 * Math.PI * (tl - LAND_T[0]) / 1.7);
      const slow = 0.12 + 0.88 * slowPh * slowPh;
      const flap = fast * wob + slow * landW;

      // Blick: Augen schnell, Kopf träge
      const target = toSrc(bx, by);
      if (dt > 0) { spring(gazeEye, target, 16, dt); spring(gazeHead, target, 3.2, dt); }
      else { gazeEye.p = target.slice(); gazeHead.p = target.slice(); }

      // Blinzeln
      let lid = 0;
      for (const b of BLINKS) { const u = (tl - b) / 0.2; if (u > 0 && u < 1) lid = Math.max(lid, Math.sin(Math.PI * u)); }
      // langsames Katzenblinzeln (Zuneigung), während er auf dem Hut sitzt
      const sb = (tl - (LAND_T[0] + 1.1)) / 1.5;
      if (sb > 0 && sb < 1) lid = Math.max(lid, Math.pow(Math.sin(Math.PI * sb), 0.6));

      const tail = { ang: rad(Math.sin(2 * Math.PI * t / 3.3) * 3), ph: 2 * Math.PI * t / 2.5, amp: 9 + 5 * Math.sin(2 * Math.PI * t / 10) };
      return { breath, head, tail, lid, fly: { x: bx, y: by, tilt, flap } };
    }

    /* Punkt im Kopf-System → Rohbild-Koordinaten (gleiche Kette wie beim Zeichnen) */
    function headPoint(h, x, y) {
      const p = L.layers.head.pivot;
      const c = Math.cos(h.roll), s = Math.sin(h.roll);
      const dx = x - p[0], dy = y - p[1];
      return [p[0] + h.tx + dx * c - dy * s, p[1] + h.ty + dx * s + dy * c];
    }

    function drawLayer(name, dx, dy) {
      const r = L.layers[name].rect;
      ctx.drawImage(img[name], r[0] + (dx || 0), r[1] + (dy || 0));
    }

    function drawEye(side, P) {
      const iris = L.layers['iris_' + side], pup = L.layers['pupil_' + side];
      const r = iris.rect, c = eyeCv[side], e = c.getContext('2d');
      e.globalCompositeOperation = 'source-over';
      e.clearRect(0, 0, c.width, c.height);
      e.drawImage(img['iris_' + side], 0, 0);
      // Pupille Richtung Ziel — pro Auge, damit er bei Nähe schielt
      const eyeAbs = headPoint(P.head, iris.center[0] + P.head.fx, iris.center[1] + P.head.fy);
      const d = [gazeEye.p[0] - eyeAbs[0], gazeEye.p[1] - eyeAbs[1]];
      const dl = Math.hypot(d[0], d[1]);
      const k = 8 / (dl + 55);
      e.globalCompositeOperation = 'source-atop';
      e.drawImage(img['pupil_' + side], pup.rect[0] - r[0] + d[0] * k, pup.rect[1] - r[1] + d[1] * k + 1.5);
      ctx.drawImage(c, r[0], r[1]);
    }

    /* Lid: echtes Fell aus der Kopf-Ebene (dort sind die Augen übermalt) deckt
       Auge samt Kontur ab; Oberlid kommt herunter, Unterlid ein Stück hoch,
       an der Kante eine gemalte Lidlinie. Außen weich ausgeblendet. */
    const lidCv = document.createElement('canvas');
    function drawLid(side, P) {
      if (P.lid < 0.02) return;
      const iris = L.layers['iris_' + side];
      const [cx, cy] = iris.center, rr = iris.radius;
      const pad = 12, R0 = rr + pad, S = Math.ceil(2 * R0);
      if (lidCv.width !== S || lidCv.height !== S) { lidCv.width = S; lidCv.height = S; }
      const g = lidCv.getContext('2d');
      const ox = cx - R0, oy = cy - R0;          // Lid-Fläche in Features-Koordinaten
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, S, S);
      const top = R0 - rr - 6, bot = R0 + rr + 6, meet = R0 + rr * 0.32;
      const yU = top + (meet - top) * P.lid;
      const yD = bot - (bot - meet) * Math.pow(P.lid, 1.6);
      const x0 = R0 - rr - 10, x1 = R0 + rr + 10, bulge = 7 + 4 * P.lid;
      g.save();
      g.beginPath();
      g.moveTo(x0, 0); g.lineTo(x1, 0); g.lineTo(x1, yU - bulge * 0.4);
      g.quadraticCurveTo(R0, yU + bulge, x0, yU - bulge * 0.4); g.closePath();
      // gleiche Kurve wie das Oberlid → geschlossen treffen sie sich ohne Spalt
      g.moveTo(x0, S); g.lineTo(x1, S); g.lineTo(x1, yD - bulge * 0.4 - 1);
      g.quadraticCurveTo(R0, yD + bulge - 1, x0, yD - bulge * 0.4 - 1); g.closePath();
      g.clip();
      // Fell der Kopf-Ebene an derselben Stelle (Features sind um fx/fy verschoben)
      const hr = L.layers.head.rect;
      g.drawImage(img.head, ox + P.head.fx - hr[0], oy + P.head.fy - hr[1], S, S, 0, 0, S, S);
      g.restore();
      // weich nach außen auslaufen lassen
      g.globalCompositeOperation = 'destination-in';
      const rg = g.createRadialGradient(R0, R0, rr + 3, R0, R0, R0);
      rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, S, S);
      // Lidlinie
      g.globalCompositeOperation = 'source-over';
      g.save();
      g.beginPath(); g.arc(R0, R0, rr + 4, 0, Math.PI * 2); g.clip();
      g.strokeStyle = '#140a04';
      g.lineCap = 'round';
      g.lineWidth = 3 + 1.5 * P.lid;
      g.globalAlpha = Math.min(1, P.lid * 3);
      g.beginPath(); g.moveTo(x0 + 6, yU - bulge * 0.4 + 2); g.quadraticCurveTo(R0, yU + bulge, x1 - 6, yU - bulge * 0.4 + 2); g.stroke();
      g.restore();
      ctx.drawImage(lidCv, ox, oy);
    }

    /* Schwanz biegen: Zeile für Zeile seitlich versetzt, in eine Zwischenfläche
       in Originalauflösung (ganze Zeilen, keine Überlappung → keine Streifen) */
    const tailCv = document.createElement('canvas');
    const TAIL_PAD = 24;
    function drawTail(T) {
      const lay = L.layers.tail, r = lay.rect, im = img.tail;
      const p = lay.pivot, span = lay.baseY - lay.tipY;
      if (tailCv.width !== r[2] + 2 * TAIL_PAD) { tailCv.width = r[2] + 2 * TAIL_PAD; tailCv.height = r[3]; }
      const t = tailCv.getContext('2d');
      t.clearRect(0, 0, tailCv.width, tailCv.height);
      for (let j = 0; j < r[3]; j++) {
        const u = clamp((lay.baseY - (r[1] + j)) / span, 0, 1);
        const off = T.amp * Math.pow(u, 1.7) * Math.sin(T.ph - u * 2.2);
        t.drawImage(im, 0, j, r[2], 1, TAIL_PAD + off, j, r[2], 1);
      }
      ctx.save();
      ctx.translate(p[0], p[1]); ctx.rotate(T.ang); ctx.translate(-p[0], -p[1]);
      ctx.drawImage(tailCv, r[0] - TAIL_PAD, r[1]);
      ctx.restore();
    }

    function drawButterfly(F) {
      const B = L.butterfly, parts = B.parts;
      const body = parts.fly_body.rect;
      const scale = FLY_SPAN / (parts.fly_wing_r.rect[0] + parts.fly_wing_r.rect[2] - parts.fly_wing_l.rect[0]);
      const cy = body[1] + body[3] * 0.45;
      ctx.save();
      ctx.translate(F.x, F.y); ctx.rotate(rad(F.tilt)); ctx.scale(scale, scale);
      ctx.translate(-B.axis, -cy);
      for (const side of ['l', 'r']) {
        const rr = parts['fly_wing_' + side].rect;
        ctx.save();
        ctx.translate(B.axis, 0); ctx.scale(F.flap, 1); ctx.translate(-B.axis, 0);
        ctx.drawImage(img['fly_wing_' + side], rr[0], rr[1]);
        ctx.restore();
      }
      ctx.drawImage(img.fly_body, body[0], body[1]);
      ctx.restore();
    }

    function render(P) {
      resize();
      const W = canvas.width;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, W);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const k = W / STAGE;
      // Bühne → Rohbild
      ctx.setTransform(k * CAT_S, 0, 0, k * CAT_S, k * (DST_C[0] - SRC_C[0] * CAT_S), k * (DST_C[1] - SRC_C[1] * CAT_S));

      // Atmen: Körper streckt sich leicht, verankert an den Pfoten
      const bs = 1 + 0.007 * P.breath;
      ctx.save();
      ctx.translate(0, 905); ctx.scale(1, bs); ctx.translate(0, -905);
      drawTail(P.tail);
      ctx.restore();

      const H = P.head, hp = L.layers.head.pivot;
      const headT = () => { ctx.translate(hp[0] + H.tx, hp[1] + H.ty); ctx.rotate(H.roll); ctx.translate(-hp[0], -hp[1]); };
      ctx.save(); headT(); drawLayer('hatback'); ctx.restore();

      ctx.save();
      ctx.translate(0, 905); ctx.scale(1, bs); ctx.translate(0, -905);
      drawLayer('body');
      ctx.restore();

      ctx.save(); headT();
      drawLayer('head');
      ctx.translate(H.fx, H.fy);
      drawLayer('features');
      drawEye('l', P); drawEye('r', P);
      drawLid('l', P); drawLid('r', P);
      ctx.restore();

      // Schmetterling auf Bühnenkoordinaten
      ctx.setTransform(k, 0, 0, k, 0, 0);
      drawButterfly(P.fly);
    }

    function frame(now) {
      if (!alive) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      clock += dt * speed;
      render(pose(clock, dt * speed));
      raf = visible ? requestAnimationFrame(frame) : 0;
    }

    let io = null;
    loadImages(base, names, opts.version).then((m) => {
      if (!alive) return;
      img = m;
      if (still) { pose(0, 0); render(pose(0, 0)); return; }
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver((ents) => {
          visible = ents.some((e) => e.isIntersecting);
          if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
        });
        io.observe(canvas);
      }
      raf = requestAnimationFrame(frame);
    }).catch((err) => { console.error(err); });

    return {
      canvas,
      setSpeed(v) { speed = v; },
      /* springt zu Sekunde t (Federn laufen 3 s vor, damit der Blick stimmt) */
      seek(t) {
        if (!img) return;
        for (let s = t - 3; s < t; s += 1 / 60) pose(s, 1 / 60);
        clock = t;
        render(pose(t, 1 / 60));
      },
      destroy() {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        if (io) io.disconnect();
        canvas.remove();
      },
    };
  }

  window.BeauRig = { mount };
})();
