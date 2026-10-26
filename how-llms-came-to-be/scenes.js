// Documentary-style 3D cold opens, one per chapter. Every scene is a pure
// function of timeline time T (no integrated state), so pause, scrub, replay
// and jump-to-beat are all just "set T and redraw".
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const BG = 0x070a12;
const C = { red: 0xff6b6b, green: 0x4dd4ac, blue: 0x6ea8ff, gold: 0xffc861, ink: 0xe8ecf6, dim: 0x5d6884, violet: 0xb48cff };
const hex = (c) => "#" + c.toString(16).padStart(6, "0");
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mix3 = (a, b, t) => a.clone().lerp(b, t);
// deterministic jitter so layouts are identical on every replay
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

let glowTex;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.15, "rgba(255,255,255,.8)");
  r.addColorStop(0.35, "rgba(255,255,255,.12)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return (glowTex = new THREE.CanvasTexture(c));
}

// ---- building blocks handed to each scene ----
function makeKit(scene) {
  const kit = {
    THREE, C, v3, mix3, lerp, ease, clamp01, rnd,
    // glowing point + optional floating label; set(pos, opacity) every frame
    node(text, color = C.ink, size = 0.55, cls = "") {
      const g = new THREE.Group();
      const mat = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat); sp.scale.setScalar(size); g.add(sp);
      let el = null;
      if (text != null) {
        el = document.createElement("div"); el.className = "sc-word " + cls; el.textContent = text;
        el.style.color = hex(color);
        const lab = new CSS2DObject(el); lab.position.set(0, size * 0.55, 0); g.add(lab);
      }
      scene.add(g);
      return {
        g, sp, el,
        set(p, op = 1, s = 1) {
          g.position.copy(p); mat.opacity = op; sp.scale.setScalar(size * s);
          g.visible = op > 0.004;
          if (el) el.style.opacity = op;
        },
        color(c) { mat.color.set(c); if (el) el.style.color = "#" + mat.color.getHexString(); },
        text(t) { if (el && el.textContent !== t) el.textContent = t; },
      };
    },
    // straight 1px line, drawn from a toward b as `draw` goes 0 -> 1
    line(color = C.dim) {
      const geo = new THREE.BufferGeometry().setFromPoints([v3(0, 0, 0), v3(0, 0, 0)]);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const ln = new THREE.Line(geo, mat); scene.add(ln);
      const pos = geo.attributes.position;
      return {
        ln, mat,
        set(a, b, draw = 1, op = 1) {
          const e = mix3(a, b, draw);
          pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, e.x, e.y, e.z); pos.needsUpdate = true;
          mat.opacity = op; ln.visible = op > 0.004 && draw > 0.001;
        },
      };
    },
    // thick glowing arc along a fixed curve, revealed via drawRange
    tube(curve, radius, color) {
      const seg = 64, rad = 8;
      const geo = new THREE.TubeGeometry(curve, seg, radius, rad, false);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(geo, mat); scene.add(m);
      const n = geo.index.count;
      return {
        m, mat, curve,
        set(draw = 1, op = 1) {
          geo.setDrawRange(0, Math.floor(n * clamp01(draw) / 6) * 6);
          mat.opacity = op; m.visible = op > 0.004 && draw > 0.001;
        },
      };
    },
    // translucent slab, used for layers and matrices
    slab(w, h, d, color, opacity = 0.12) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),
        new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false }));
      m.add(edges); scene.add(m);
      return {
        m, set(p, op = 1, sy = 1) {
          m.position.copy(p); m.scale.set(1, sy, 1); mat.opacity = opacity * op; edges.material.opacity = 0.7 * op; m.visible = op > 0.004;
        },
      };
    },
    // big screen-space title card (quotes, years) rendered in DOM over the canvas
    card: null,
    camera: null,
    // narrower-than-16:9 frames (square video, portrait phones) dolly back so the shot still fits
    look(pos, target) {
      const f = Math.pow(Math.max(1, (16 / 9) / kit.camera.aspect), 0.85);
      kit.camera.position.copy(target).addScaledVector(pos.clone().sub(target), f);
      kit.camera.lookAt(target);
    },
  };
  return kit;
}

// ======================================================================
// Scenes. Each returns { beats: [{ cap, kick?, dur, quote? }], tick(ph, T) }.
// ph(i, a, b) = eased 0..1 progress through fraction [a, b] of beat i
// (0 before it, 1 after it), so a scene reads like a shot list.
// ======================================================================

// Ch1: the distributional hypothesis. A word is the company it keeps:
// shared context words pull dog and cat together; do it for every word and
// meaning becomes geometry.
function distribScene(k) {
  const { C, v3, mix3, lerp, rnd } = k;
  const dog = k.node("dog", C.ink, 0.9, "big");
  const cat = k.node("cat", C.ink, 0.9, "big");
  const car = k.node("car", C.ink, 0.9, "big");
  const ring = (c, i, n, r, z = 0) => v3(c.x + Math.cos(i / n * 6.283 + 0.4) * r, c.y + Math.sin(i / n * 6.283 + 0.4) * r * 0.75, c.z + z);
  const shared = ["feed", "vet", "pet"].map((w) => ({ w, n: k.node(w, C.gold, 0.4) }));
  const dogOnly = ["bark", "leash"].map((w) => ({ w, n: k.node(w, C.blue, 0.4) }));
  const catOnly = ["purr", "litter"].map((w) => ({ w, n: k.node(w, C.green, 0.4) }));
  const carOnly = ["road", "engine", "drive"].map((w) => ({ w, n: k.node(w, C.red, 0.4) }));
  const dogLines = [...shared, ...dogOnly].map(() => k.line(C.blue));
  const catLines = [...shared, ...catOnly].map(() => k.line(C.green));
  const carLines = carOnly.map(() => k.line(C.red));

  const clusters = [
    { c: v3(-4.6, 1.2, -1), col: C.blue, w: ["horse", "cow", "wolf", "mouse", "sheep", "rabbit"] },
    { c: v3(5.0, 1.6, -2), col: C.red, w: ["truck", "bus", "bike", "train", "van", "boat"] },
    { c: v3(0.4, -3.4, -1.5), col: C.green, w: ["bread", "rice", "apple", "soup", "cheese", "milk"] },
  ];
  const many = clusters.flatMap((cl, ci) => cl.w.map((w, i) => {
    const off = v3(rnd(ci * 31 + i) - 0.5, rnd(ci * 17 + i + 5) - 0.5, rnd(ci * 7 + i + 9) - 0.5).multiplyScalar(4.2);
    const from = v3((rnd(i + ci * 50) - 0.5) * 30, (rnd(i * 3 + ci) - 0.5) * 18, -14 - rnd(i + 77) * 10);
    return { n: k.node(w, cl.col, 0.42), home: cl.c.clone().add(off), from, delay: rnd(ci * 9 + i) * 0.5 };
  }));

  return {
    beats: [
      { kick: "1954", cap: "A question with no machine to answer it yet: what does a word <em>mean</em>?", dur: 6 },
      { kick: "Zellig Harris", cap: "Don't ask what it means. Watch <em>where it shows up</em>, and which words it keeps company with.", dur: 7.5 },
      { cap: "Another word. Different company, but some of it is the same company.", dur: 7 },
      { cap: "Shared neighbours pull the two together. A word with none, like <em>car</em>, stays far away.", dur: 8 },
      { cap: "Do this for every word in a library, and meaning turns into <em>geometry</em>.", dur: 9 },
      { kick: "J. R. Firth, 1957", quote: true, cap: "“You shall know a word by the company it keeps.”", dur: 7 },
    ],
    tick(ph, T) {
      const pull = ph(3, 0.1, 0.8), fadeCtx = 1 - ph(4, 0, 0.35);
      const dogP = mix3(v3(0, 0, 0), v3(-2.2, 0, 0), ph(2, 0, 0.4)).lerp(v3(-0.7, 0.1, 0), pull);
      const catP = mix3(v3(4.4, 0.4, -0.5), v3(0.8, -0.1, 0), pull);
      dog.set(dogP, ph(0, 0, 0.3));
      cat.set(catP, ph(2, 0, 0.3));
      const carP = v3(-6.5, 2.2, -3);
      car.set(carP, ph(3, 0.3, 0.6) * (1 - ph(4, 0.2, 0.5)));

      // shared words sit between the two once both exist
      shared.forEach((s, i) => {
        const solo = ring(dogP, i, 5, 2.1);
        const mid = mix3(dogP, catP, 0.5).add(v3(0, 1.5 - i * 1.5, 0.6));
        const p = mix3(solo, mid, ph(2, 0.2, 0.7));
        s.n.set(p, ph(1, 0.1 + i * 0.1, 0.4 + i * 0.1) * fadeCtx, 1 + 0.5 * ph(3, 0, 0.3) * (1 - ph(4)));
        dogLines[i].set(dogP, p, ph(1, 0.2 + i * 0.1, 0.6 + i * 0.1), 0.55 * fadeCtx);
        catLines[i].set(catP, p, ph(2, 0.4, 0.8), 0.55 * fadeCtx);
      });
      dogOnly.forEach((s, i) => {
        const p = ring(dogP, i + 3, 5, 2.1).add(v3(-0.8 * ph(2, 0, 0.4), 0, 0));
        s.n.set(p, ph(1, 0.4 + i * 0.1, 0.7 + i * 0.1) * fadeCtx);
        dogLines[i + 3].set(dogP, p, ph(1, 0.5 + i * 0.1, 0.9), 0.55 * fadeCtx);
      });
      catOnly.forEach((s, i) => {
        const p = ring(catP, i, 2, 2.0).add(v3(1.2, 0, 0));
        s.n.set(p, ph(2, 0.3 + i * 0.1, 0.6) * fadeCtx);
        catLines[i + 3].set(catP, p, ph(2, 0.5, 0.9), 0.55 * fadeCtx);
      });
      carOnly.forEach((s, i) => {
        const p = ring(carP, i, 3, 1.7);
        const op = ph(3, 0.4 + i * 0.08, 0.7) * (1 - ph(4, 0.2, 0.5));
        s.n.set(p, op);
        carLines[i].set(carP, p, ph(3, 0.5, 0.9), 0.5 * op);
      });

      // the whole vocabulary condenses out of the dark into clusters
      const settle = ph(4, 0.2, 0.9), dimQ = 1 - 0.7 * ph(5, 0, 0.3);
      many.forEach((m, i) => {
        const t = k.clamp01((settle - m.delay * 0.5) / 0.7);
        const p = mix3(m.from, m.home, k.ease(t));
        p.y += Math.sin(T * 0.6 + i) * 0.06;
        m.n.set(p, k.ease(t) * dimQ);
      });
      // dog & cat join the animal cluster
      if (ph(4, 0.3) > 0) {
        const t = ph(4, 0.3, 0.9);
        dog.set(mix3(dogP, v3(-2.2, 0.0, 0.4), t), dimQ);
        cat.set(mix3(catP, v3(-3.4, -0.9, 0.6), t), dimQ);
      }

      const pull2 = ph(4, 0, 1), orbit = T * 0.05;
      const r = lerp(lerp(8, 9.5, ph(1)), 19, pull2);
      k.look(v3(Math.sin(orbit) * r * 0.25 + lerp(0, 1.2, ph(2)), lerp(0.6, 3, pull2), r),
             v3(lerp(0, 0.8, ph(2) * (1 - pull2)), lerp(0, -0.2, pull2), 0));
    },
  };
}

// Ch7: the Transformer. Delete the recurrent chain; every word fires a Query
// at every Key at once, Values flow back, and the word rewrites itself.
function selfAttnScene(k) {
  const { C, v3, mix3, lerp, rnd, THREE } = k;
  const words = ["she", "sat", "by", "the", "river", "bank"];
  const N = words.length, B = 5, X = (i) => (i - (N - 1) / 2) * 1.7;
  const tok = words.map((w, i) => k.node(w, C.ink, 0.7, "big"));
  const chain = words.slice(1).map(() => k.line(C.violet));
  const pulse = k.node(null, C.violet, 0.9);
  // the hidden state fading as it is passed down the chain
  const qkv = words.map(() => [C.red, C.green, C.blue].map((c) => k.slab(0.16, 1, 0.16, c, 0.55)));
  // bank's attention: hand-set, illustrative; river wins
  const wBank = [0.03, 0.05, 0.06, 0.04, 0.62, 0.2];
  const arcFor = (i, j, lift, z = 0) => {
    const a = v3(X(i), 0.9, 0), b = v3(X(j), 0.9, 0);
    const c = v3((X(i) + X(j)) / 2, 0.9 + lift + Math.abs(X(i) - X(j)) * 0.42, z);
    return new THREE.QuadraticBezierCurve3(a, c, b);
  };
  const bankArcs = words.map((_, j) => j === B ? null : k.tube(arcFor(B, j, 0.4), 0.015 + wBank[j] * 0.09, j === 4 ? C.gold : C.red));
  const pct = words.map((_, j) => { const n = k.node(Math.round(wBank[j] * 100) + "%", j === 4 ? C.gold : C.dim, 0.01, "pct"); return n; });
  // Value particles riding the arcs back into bank, count proportional to weight
  const parts = [];
  words.forEach((_, j) => {
    if (j === B) return;
    const n = Math.max(2, Math.round(wBank[j] * 26));
    for (let q = 0; q < n; q++) parts.push({ j, off: q / n, n: k.node(null, j === 4 ? C.green : C.blue, 0.22 + wBank[j] * 0.4) });
  });
  const gloss = k.node("≈ riverbank, shore", C.green, 0.01, "gloss");
  // all-pairs attention for the "everyone at once" shot
  const allArcs = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) {
    const w = (Math.abs(i - j) === 1 ? 0.5 : 0.18) + ((i === 4 && j === 5) || (i === 5 && j === 4) ? 0.6 : 0) + rnd(i * 7 + j) * 0.2;
    allArcs.push({ w, delay: rnd(i * 13 + j * 3), t: k.tube(arcFor(i, j, 0.1, (i - j) * 0.16), 0.006 + w * 0.012, [C.red, C.gold, C.blue, C.green, C.violet][(i + j) % 5]) });
  }
  // the layer stack
  const L = 7;
  const layers = Array.from({ length: L }, (_, l) => ({
    slab: k.slab(N * 1.7 + 0.6, 0.04, 1.6, C.blue, 0.18),
    dots: words.map((w) => k.node(null, l === L - 1 ? C.gold : C.ink, 0.35)),
  }));

  return {
    beats: [
      { kick: "Before 2017", cap: "Language models read like a bucket brigade: one word at a time, each handing a summary to the next.", dur: 7.5 },
      { cap: "Slow, since nothing runs in parallel. And by the end of a long chain, the start has faded.", dur: 6 },
      { kick: "Vaswani et al., 2017", cap: "The bet: <em>delete the chain.</em> Give every word three new vectors: a <span class=q>Query</span>, a <span class=k>Key</span>, a <span class=v>Value</span>.", dur: 8 },
      { cap: "<em>bank</em> fires its Query at every Key at once. The strongest match: <em>river</em>.", dur: 8 },
      { cap: "Each neighbour hands over its <span class=v>Value</span>, scaled by that weight. <em>river</em> gives the most, and <em>bank</em> now means the shore.", dur: 8.5 },
      { cap: "Every word does this at the same time. Any distance, one hop, perfectly parallel.", dur: 8 },
      { kick: "The Transformer", cap: "Stack that layer dozens of times. This is the engine inside BERT, GPT and Claude.", dur: 9 },
    ],
    tick(ph, T) {
      const lift = ph(6, 0, 0.9);
      // chain era: a pulse walks left to right, dimming as it goes
      const walk = ph(0, 0.15, 0.95) * (N - 1);
      const chainFade = 1 - ph(2, 0, 0.3);
      const fallen = ph(2, 0, 0.35);
      tok.forEach((t, i) => {
        const lit = clamp(1 - Math.abs(walk - i) * 0.9);
        const base = ph(0, i * 0.05, 0.1 + i * 0.05);
        t.set(v3(X(i), 0, 0), base * (1 - lift * 0.85), 1 + 0.6 * lit * (1 - ph(1, 0.7)));
      });
      chain.forEach((c, i) => {
        const a = v3(X(i), 0, 0), b = v3(X(i + 1), 0, 0);
        const drop = v3(0, -fallen * 2.5 - i * fallen * 0.3, 0);
        c.set(a.clone().add(drop), b.clone().add(drop), clamp(walk - i), 0.8 * chainFade);
      });
      // the carried state: strong at word 1, ghostly by word 6
      const memory = 1 - walk / (N - 1) * 0.85;
      const px = walk <= 0 ? X(0) : X(Math.min(walk, N - 1) | 0) + (walk % 1) * 1.7;
      pulse.set(v3(Math.min(px, X(N - 1)), 0, 0), ph(0, 0.1, 0.2) * memory * (1 - ph(1, 0.6, 1)), 0.6 + memory);

      // Q K V bars rise out of each word
      qkv.forEach((bars, i) => bars.forEach((b, q) => {
        const g = ph(2, 0.35 + i * 0.06, 0.6 + i * 0.06);
        const h = 0.25 + 0.55 * rnd(i * 3 + q);
        b.set(v3(X(i) + (q - 1) * 0.22, -0.55 - h * g / 2, 0), g * (1 - ph(5, 0, 0.4)) * (1 - lift), g * h);
      }));

      // bank's query arcs, then value particles
      const valFade = 1 - ph(5, 0, 0.4);
      bankArcs.forEach((a, j) => { if (a) a.set(ph(3, 0.1 + j * 0.05, 0.5 + j * 0.05), (j === 4 ? 1 : 0.75) * valFade * (1 - lift)); });
      pct.forEach((p, j) => p.set(v3(X(j), 1.55, 0), (j === B ? 0 : ph(3, 0.55, 0.8)) * valFade * (1 - lift)));
      const flow = ph(4, 0.05, 0.25) * (1 - ph(4, 0.85, 1));
      parts.forEach((p) => {
        const u = ((T * 0.45 + p.off) % 1);
        p.n.set(bankArcs[p.j].curve.getPoint(1 - u), flow * Math.sin(u * Math.PI));
      });
      const rewrite = ph(4, 0.3, 0.8) * (1 - ph(5, 0, 0.3));
      tok[B].color(new THREE.Color(C.ink).lerp(new THREE.Color(C.green), rewrite));
      gloss.set(v3(X(B), -1.75, 0), rewrite * (1 - lift));

      // everyone at once
      const all = ph(5, 0.15, 0.85);
      allArcs.forEach((a) => {
        const d = clamp((all - a.delay * 0.4) / 0.6);
        a.t.set(d, a.w * 0.9 * (1 - lift * 0.8));
      });

      // stack of layers rising up
      layers.forEach((ly, l) => {
        const g = clamp((lift * (L + 1) - l));
        const y = l * 1.25;
        ly.slab.set(v3(0, y - 0.05, 0), g * (l === 0 ? 1 : 0.9));
        ly.dots.forEach((d, i) => d.set(v3(X(i), y, 0), l === 0 ? 0 : g * 0.9));
      });

      // camera: flat side-on for the chain, rising to a 3/4 orbit, then pulling back over the stack
      const orbit = ph(5, 0, 1) * 0.42 + lift * 0.25;
      const r = lerp(lerp(11, 9.5, ph(3)), 19, lift);
      const yCam = lerp(lerp(0.8, 2.2, ph(3)), 5, ph(5)) + lift * 6;
      k.look(v3(Math.sin(orbit) * r, yCam, Math.cos(orbit) * r),
             v3(lerp(lerp(0, 0.4, ph(3)), 0, ph(5)), lerp(0.6, 4, lift), 0));
    },
  };
}
const clamp = clamp01;

const SCENES = { distrib: distribScene, selfattn: selfAttnScene };

// ======================================================================
// Player: letterboxed canvas, lower-third captions, segmented scrubber.
// ======================================================================
const live = new Set();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function mount(host) {
  if (host.dataset.mounted) return;
  const build = SCENES[host.dataset.scene];
  if (!build) return;
  host.dataset.mounted = "1";
  // render mode (render.html + tools/render-films.mjs): no player loop or controls;
  // the caller steps time with __film.renderAt(t) and screenshots each frame
  const render = !!host.dataset.render;
  if (render) host.classList.add("render");
  host.innerHTML = `
    <div class="sc-view"></div>
    <div class="sc-grain"></div>
    <div class="sc-cap"><div class="sc-kick"></div><div class="sc-text"></div></div>
    <button class="sc-big" aria-label="play">▶</button>
    <div class="sc-fade"></div>
    <div class="sc-end"><div class="sc-end-t"></div><div class="sc-end-u">chadsmith.dev/how-llms-came-to-be</div></div>
    <div class="sc-ctl">
      <button class="sc-play" aria-label="play/pause">▶</button>
      <div class="sc-track"></div>
      <span class="sc-time"></span>
      <button class="sc-fs" aria-label="fullscreen">⛶</button>
    </div>`;
  const view = host.querySelector(".sc-view");
  const capEl = host.querySelector(".sc-cap"), kickEl = host.querySelector(".sc-kick"), textEl = host.querySelector(".sc-text");
  const playBtn = host.querySelector(".sc-play"), bigBtn = host.querySelector(".sc-big"), track = host.querySelector(".sc-track"), timeEl = host.querySelector(".sc-time");

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(BG);
  view.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = "sc-labels";
  view.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.028);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 300);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.35, 0.35);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // faint dust so camera moves read as motion through space
  {
    const n = 900, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (rnd(i) - 0.5) * 80; p[i * 3 + 1] = (rnd(i + 1e3) - 0.5) * 50; p[i * 3 + 2] = (rnd(i + 2e3) - 0.5) * 80 - 10; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x3a4566, size: 0.06, transparent: true, opacity: 0.7 })));
  }

  const kit = makeKit(scene); kit.camera = camera;
  const sc = build(kit);
  const starts = []; let total = 0;
  for (const b of sc.beats) { starts.push(total); total += b.dur; }
  const ph = (i, a = 0, b = 1) => {
    const d = sc.beats[i].dur, s = starts[i] + a * d, e = starts[i] + b * d;
    return ease(clamp01((T - s) / Math.max(1e-6, e - s)));
  };

  track.innerHTML = sc.beats.map((b) => `<div class="sc-seg" style="flex:${b.dur}"><i></i></div>`).join("");
  const segs = [...track.children];
  // seeking after the end resumes playback; otherwise the ↺ overlay stays up and it looks like nothing happened
  const seekTo = (t) => {
    const wasEnded = !playing && T >= total - 0.01;
    T = Math.max(0, Math.min(total, t));
    if (wasEnded && T < total - 0.01) setPlaying(true); else setPlaying(playing);
    draw(true);
  };
  // handy for poking at a single shot from devtools: $(".scene").seek(12)
  host.seek = (t) => { setPlaying(false); T = Math.max(0, Math.min(total, t)); setPlaying(false); draw(true); };
  track.addEventListener("pointerdown", (e) => {
    const move = (ev) => { const r = track.getBoundingClientRect(); seekTo(clamp01((ev.clientX - r.left) / r.width) * total); };
    move(e); track.setPointerCapture(e.pointerId);
    track.onpointermove = move; track.onpointerup = () => { track.onpointermove = null; };
  });

  let T = 0, playing = false, beat = -1, raf = 0, last = 0, visible = false, started = false;
  const setPlaying = (p) => {
    if (p && T >= total - 0.01) T = 0;
    playing = p; started ||= p;
    playBtn.textContent = p ? "❚❚" : T >= total - 0.01 ? "↺" : "▶";
    bigBtn.textContent = T >= total - 0.01 ? "↺" : "▶";
    host.classList.toggle("playing", p);
    host.classList.toggle("fresh", !started);
    host.classList.toggle("ended", !p && T >= total - 0.01);
    last = performance.now();
  };
  playBtn.onclick = bigBtn.onclick = () => setPlaying(!playing);
  view.onclick = () => setPlaying(!playing);
  // iPhone Safari has no element fullscreen, and embedded/automated browsers can
  // refuse it; both fall back to a fixed full-window overlay
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const isFull = () => fsEl() === host || host.classList.contains("pseudo-fs");
  const setPseudo = (on) => {
    host.classList.toggle("pseudo-fs", on);
    document.documentElement.classList.toggle("sc-lock", on);
    afterFs();
  };
  host.querySelector(".sc-fs").onclick = async () => {
    if (host.classList.contains("pseudo-fs")) return setPseudo(false);
    if (fsEl()) return void (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    const req = host.requestFullscreen || host.webkitRequestFullscreen;
    try { if (!req) throw new Error("unsupported"); await req.call(host); } catch { setPseudo(true); }
  };
  const onKey = (e) => { if (e.key === "Escape" && host.classList.contains("pseudo-fs")) setPseudo(false); };
  // entering or leaving fullscreen must never leave the film paused-by-visibility or at the old size
  function afterFs() { visible = isFull() || visible; resize(); last = performance.now(); }
  document.addEventListener("fullscreenchange", afterFs);
  document.addEventListener("webkitfullscreenchange", afterFs);
  document.addEventListener("keydown", onKey);

  function caption(i) {
    if (i === beat) return;
    beat = i;
    const b = sc.beats[i];
    capEl.classList.remove("in"); void capEl.offsetWidth;
    kickEl.textContent = b.kick || "";
    textEl.innerHTML = b.cap;
    capEl.classList.toggle("quote", !!b.quote);
    capEl.classList.add("in");
  }

  function draw(force) {
    let i = 0; while (i < starts.length - 1 && T >= starts[i + 1]) i++;
    caption(i);
    if (render) renderOverlays(i);
    sc.tick(ph, T);
    segs.forEach((s, j) => { s.firstChild.style.width = (clamp01((T - starts[j]) / sc.beats[j].dur) * 100) + "%"; });
    const sec = (x) => `${(x / 60) | 0}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
    timeEl.textContent = `${sec(T)} / ${sec(total)}`;
    composer.render();
    labels.render(scene, camera);
  }

  // CSS transitions run on wall-clock time, which means nothing when frames are
  // stepped; in render mode every fade is a function of T instead
  const fadeEl = host.querySelector(".sc-fade"), endEl = host.querySelector(".sc-end");
  endEl.querySelector(".sc-end-t").textContent = host.dataset.title || "";
  const TAIL = 3.5;
  function renderOverlays(i) {
    const s0 = starts[i], e0 = s0 + sc.beats[i].dur, lastBeat = i === starts.length - 1;
    const out = clamp01((T - total) / 0.5);
    const a = clamp01((T - s0) / 0.6) * (lastBeat ? 1 : clamp01((e0 - T) / 0.35)) * (1 - out);
    capEl.style.opacity = a;
    capEl.style.transform = `translateY(${(1 - a) * 8}px)`;
    fadeEl.style.opacity = Math.max(1 - clamp01(T / 0.8), 0.82 * clamp01((T - total) / 0.8));
    endEl.style.opacity = clamp01((T - total - 0.4) / 0.8);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible && !isFull()) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) {
      T += dt;
      if (T >= total) { T = total; setPlaying(false); }
    }
    draw();
  }

  const resize = () => {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    // cap the drawing buffer near 3.5 MP: bloom runs on every pixel, and fullscreen at
    // 2x density on a large display is enough to stall the GPU
    const pr = Math.min(devicePixelRatio, 2, Math.sqrt(3.5e6 / (w * h)));
    renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
    renderer.setSize(w, h, false); composer.setSize(w, h); labels.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    // video text must survive a phone-sized X feed, so render mode scales by height and goes bigger
    host.style.setProperty("--sc-scale", render ? h / 540 : Math.min(1.25, Math.max(0.62, w / 900)));
  };
  const ro = new ResizeObserver(resize); ro.observe(view); resize();

  // autoplay once the film is mostly on screen, like a muted documentary embed
  const io = new IntersectionObserver(([e]) => {
    if (isFull()) return;
    visible = e.isIntersecting;
    if (visible && e.intersectionRatio > 0.6 && !started && !reduceMotion) setPlaying(true);
    if (!visible && playing) setPlaying(false);
  }, { threshold: [0, 0.6] });
  io.observe(host);

  setPlaying(false); draw(true);
  if (render) {
    io.disconnect();
    window.__film = { duration: total + TAIL, renderAt(t) { T = t; draw(true); } };
  } else raf = requestAnimationFrame(frame);

  live.add({
    host,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener("fullscreenchange", afterFs);
      document.removeEventListener("webkitfullscreenchange", afterFs);
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("sc-lock");
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      composer.dispose?.(); renderer.dispose(); renderer.forceContextLoss();
    },
  });
}

// app.js is a classic script that re-renders the chapter via innerHTML; it
// calls these hooks around each render. WebGL contexts are capped per page,
// so every old scene must be torn down before the next chapter mounts.
window.disposeScenes = () => { for (const s of live) s.dispose(); live.clear(); };
window.mountScenes = (root) => root.querySelectorAll(".scene").forEach(mount);
window.mountScenes(document);
