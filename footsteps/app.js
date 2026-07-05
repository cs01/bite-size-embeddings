// App logic: render the journey, drive navigation, score quizzes, persist
// progress in localStorage, and power the two interactive widgets.

const KEY = "footsteps.progress.v1";
let state = load();
// A `#<n>` hash (1-based lesson number) deep-links a specific chapter and wins
// over saved progress, so shared / cross-site links (e.g. from svd-explorer)
// land on the right lesson.
function lessonFromHash() {
  const n = parseInt((location.hash || "").replace(/^#/, ""), 10);
  return Number.isFinite(n) ? n - 1 : NaN;
}
let current = (() => {
  const h = lessonFromHash();
  return h >= 0 ? h : (state.last || 0);
})();

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { done: {}, last: 0 }; }
  catch { return { done: {}, last: 0 }; }
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

// ---- section renderers ----
const CALLOUT_LABEL = { desk: "The problem on their desk", leap: "The leap", aside: "Notice", legacy: "What it left us" };

// The resolution, told after the story — what the world came out the other
// side with. Sits at the bottom so the problem, not the answer, opens each
// chapter.
function renderSummary(summary) {
  if (!summary) return "";
  return `<div class="summary"><span class="summary-tag">Where this landed</span><span class="summary-body">${summary}</span></div>`;
}

// Canonical-paper citation(s), offered at the end as further reading — after
// the story has earned the reader's interest in the source.
function renderFurther(src) {
  if (!src) return "";
  const arr = Array.isArray(src) ? src : [src];
  const links = arr.map((s) => `<a class="src-link" href="${s.url}" target="_blank" rel="noopener">${s.label} ↗</a>`).join("");
  return `<div class="further"><span class="further-tag">Further reading</span>${links}</div>`;
}

function renderBody(body) {
  return body.map((s) => {
    if (s.p) return `<p class="${s.lead ? "lead" : ""}">${s.p}</p>`;
    if (s.h) return `<h3>${s.h}</h3>`;
    if (s.eq) return `<code class="eq">${s.eq.replace(/\n/g, "<br>")}</code>`;
    for (const k of ["desk", "leap", "aside", "legacy"]) {
      if (s[k]) return `<div class="callout ${k}"><span class="tag">${CALLOUT_LABEL[k]}</span>${s[k]}</div>`;
    }
    if (s.widget) return `<div class="widget" data-widget="${s.widget}"></div>`;
    return "";
  }).join("");
}

function renderQuiz(quiz, li) {
  if (!quiz || !quiz.length) return "";
  const items = quiz.map((q, qi) => {
    // display options in a seeded-shuffled order (stable across visits) so the
    // correct answer isn't always in the same slot; data-oi keeps the original
    // index, so scoring is unaffected
    const order = q.options.map((_, oi) => oi);
    let seed = li * 2654435761 + qi * 40503 + 1;
    for (let i = order.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const opts = order.map((oi) =>
      `<button class="opt" data-li="${li}" data-qi="${qi}" data-oi="${oi}">${q.options[oi]}</button>`).join("");
    return `<div class="q">${q.q}</div>${opts}<div class="explain" id="ex-${li}-${qi}"></div>`;
  }).join("");
  return `<div class="quiz-sep"><span>✦ Check yourself</span></div><div class="quiz">${items}</div>`;
}

function render() {
  current = Math.max(0, Math.min(current, LESSONS.length - 1));
  // keep URL shareable/deep-linkable without spamming history
  if (history.replaceState) history.replaceState(null, "", `#${current + 1}`);
  const l = LESSONS[current];
  const el = document.getElementById("lesson");
  el.classList.remove("fade"); void el.offsetWidth; el.classList.add("fade");
  el.innerHTML =
    `<div class="era">${l.year}</div>` +
    `<h2 class="lt">${l.title}</h2>` +
    `<div class="people">${l.people}</div>` +
    renderBody(l.body) +
    renderSummary(l.summary) +
    renderFurther(l.source) +
    renderQuiz(l.quiz, current);

  el.scrollTop = 0;
  el.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", onAnswer));
  el.querySelectorAll(".widget").forEach(mountWidget);

  document.getElementById("prev").disabled = current === 0;
  document.getElementById("next").disabled = current === LESSONS.length - 1;
  document.getElementById("crumb").textContent = `${current + 1} / ${LESSONS.length}`;
  state.last = current; save();
  renderRail();
}

// ---- quiz scoring ----
function onAnswer(e) {
  const { li, qi, oi } = e.target.dataset;
  const q = LESSONS[li].quiz[qi];
  const chosen = +oi;
  const group = e.target.parentElement.querySelectorAll(`.opt[data-qi="${qi}"]`);
  group.forEach((b) => {
    b.disabled = true;
    const o = +b.dataset.oi;
    if (o === q.answer) b.classList.add("correct");
    else if (o === chosen) b.classList.add("wrong");
  });
  const ex = document.getElementById(`ex-${li}-${qi}`);
  const right = chosen === q.answer;
  ex.innerHTML = `<b>${right ? "✓ Correct." : "✗ Not quite."}</b> ${q.explain}`;
  ex.classList.add("show");

  // Lesson counts as done once every question has been attempted.
  state.done[li] = state.done[li] || {};
  state.done[li][qi] = right;
  save();
  renderRail();
}

function lessonComplete(li) {
  const total = LESSONS[li].quiz ? LESSONS[li].quiz.length : 0;
  if (!total) return false;
  const d = state.done[li] || {};
  return Object.keys(d).length >= total;
}

// ---- timeline rail ----
function renderRail() {
  const tl = document.getElementById("timeline");
  tl.innerHTML = LESSONS.map((l, i) => {
    const cls = ["tl-item", i === current ? "active" : "", lessonComplete(i) ? "done" : ""].join(" ");
    return `<div class="${cls}" data-i="${i}"><span class="tl-dot"></span>` +
      `<div class="tl-year">${l.year}</div><div class="tl-title">${l.title}</div></div>`;
  }).join("");
  tl.querySelectorAll(".tl-item").forEach((it) =>
    it.addEventListener("click", () => { current = +it.dataset.i; render(); }));

  const done = LESSONS.filter((_, i) => lessonComplete(i)).length;
  document.getElementById("overall-bar").style.width = `${(done / LESSONS.length) * 100}%`;
  document.getElementById("overall-label").textContent = `${done} / ${LESSONS.length} chapters complete`;
}

// ---- interactive widgets ----
const WIDGETS = {
  cosine: cosineWidget, attention: attentionWidget, attnmatrix: attnMatrixWidget,
  autoregress: autoregressWidget, distrib: distribWidget, trainvec: trainvecWidget,
  analogy: analogyWidget, polysemy: polysemyWidget, maskfill: maskfillWidget,
  pool: poolWidget, twins: twinsWidget, bpe: bpeWidget, scaling: scalingWidget,
  rlhf: rlhfWidget, think: thinkWidget,
};
function mountWidget(el) {
  const fn = WIDGETS[el.dataset.widget];
  if (fn) fn(el);
}

// Full self-attention as an N×N heatmap: row = the querying token, column = the
// token it attends to, cell = softmax weight (each row sums to 1). Affinities are
// hand-set (illustrative, not a real model) — the point is the *shape*: every
// token reading every token, and how the causal mask blacks out the future.
function attnMatrixWidget(el) {
  const toks = ["I", "sat", "on", "the", "river", "bank"];
  // pre-softmax logits[query][key]; diagonal self-weight + a few semantic pulls
  // (subject↔verb, determiner↔noun, river↔bank) so the pattern reads as meaning
  const logit = [
    //  I   sat  on  the  riv bank
    [1.0, 1.2, 0.2, 0.2, 0.2, 0.2], // I → its verb
    [1.6, 1.0, 0.7, 0.2, 0.2, 0.2], // sat → subject "I"
    [0.2, 1.0, 1.0, 0.9, 0.2, 0.2], // on → verb/det
    [0.2, 0.2, 0.7, 1.0, 1.2, 1.2], // the → the nouns
    [0.2, 0.2, 0.2, 0.8, 1.0, 2.0], // river → bank
    [0.2, 0.2, 0.2, 0.9, 2.6, 1.0], // bank → river (disambiguate!)
  ];
  let causal = true, hover = -1;
  const N = toks.length, cell = 46, padL = 52, padT = 56;

  function weights(i) {
    const row = logit[i].map((v, j) => (causal && j > i) ? -Infinity : v);
    const ex = row.map((v) => Math.exp(v));
    const s = ex.reduce((a, b) => a + b, 0);
    return ex.map((v) => v / s);
  }
  function lerp(w) { // bg → accent blue by weight
    const a = [237, 240, 243], b = [37, 99, 235];
    return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * w)).join(",")})`;
  }
  function draw() {
    const W = padL + N * cell + 10, H = padT + N * cell + 64;
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;height:auto">`;
    // column labels (keys)
    toks.forEach((t, j) => {
      s += `<text x="${padL + j * cell + cell / 2}" y="${padT - 12}" fill="#6b7280" font-size="12" text-anchor="middle">${t}</text>`;
    });
    s += `<text x="${padL + N * cell / 2}" y="18" fill="#9ca3af" font-size="11" text-anchor="middle">attends to →</text>`;
    for (let i = 0; i < N; i++) {
      const w = weights(i);
      // row label (query)
      s += `<text x="${padL - 10}" y="${padT + i * cell + cell / 2 + 4}" fill="${i === hover ? "#1f2937" : "#6b7280"}" font-size="12" text-anchor="end">${toks[i]}</text>`;
      for (let j = 0; j < N; j++) {
        const masked = causal && j > i;
        const fill = masked ? "#f1f2f0" : lerp(w[j]);
        const op = i === hover || hover < 0 ? 1 : 0.35;
        s += `<rect data-i="${i}" x="${padL + j * cell}" y="${padT + i * cell}" width="${cell - 3}" height="${cell - 3}" rx="3" fill="${fill}" opacity="${op}" style="cursor:pointer"/>`;
        if (!masked && w[j] >= 0.08) s += `<text x="${padL + j * cell + (cell - 3) / 2}" y="${padT + i * cell + (cell - 3) / 2 + 4}" fill="${w[j] > 0.45 ? "#ffffff" : "#374151"}" font-size="10" text-anchor="middle" pointer-events="none">${w[j].toFixed(2)}</text>`;
      }
    }
    s += `</svg>`;
    const lead = hover < 0 ? `<span style="color:var(--muted)">hover a row to read where that word looks</span>`
      : `<b>${toks[hover]}</b> looks at: ` + weights(hover).map((v, j) => ({ t: toks[j], v }))
        .filter((x) => x.v >= 0.05).sort((a, b) => b.v - a.v)
        .map((x) => `${x.t} <b style="color:var(--accent)">${x.v.toFixed(2)}</b>`).join(" · ");
    el.innerHTML =
      `<div style="margin-bottom:10px">` +
      `<button class="opt mask ${causal ? "on" : ""}" data-c="1" style="display:inline-block;width:auto;margin:0 6px 0 0">causal mask · GPT</button>` +
      `<button class="opt mask ${causal ? "" : "on"}" data-c="0" style="display:inline-block;width:auto">full · BERT</button></div>` +
      s + `<div class="readout" style="margin-top:10px;font-size:14px;min-height:1.4em">${lead}</div>`;
    el.querySelectorAll("rect[data-i]").forEach((r) =>
      r.addEventListener("mouseenter", () => { hover = +r.dataset.i; draw(); }));
    el.querySelector("svg").addEventListener("mouseleave", () => { hover = -1; draw(); });
    el.querySelectorAll(".mask").forEach((b) =>
      b.addEventListener("click", () => { causal = b.dataset.c === "1"; draw(); }));
  }
  draw();
}

// Toy autoregressive generator: predict→append→repeat. Canned guesses keyed on
// the last TWO words (a tiny order-2 model — NOT a real network). Keying on two
// words instead of one is enough to write a clean sentence and stop, and it sets
// up the honest point: a real GPT conditions on the *entire* history via
// attention, which is why it stays coherent instead of looping a fixed table.
function autoregressWidget(el) {
  const start = ["The", "capital", "of", "France", "is"];
  const table = {
    "France is": [["Paris", 0.86], ["a", 0.06], ["the", 0.04]],
    "is Paris": [[".", 0.60], [",", 0.22], ["today", 0.08]],
    "Paris .": [["It", 0.52], ["The", 0.28], ["Paris", 0.06]],
    ". It": [["is", 0.60], ["has", 0.20], ["sits", 0.10]],
    "It is": [["home", 0.42], ["a", 0.30], ["famous", 0.18]],
    "is home": [["to", 0.95], ["for", 0.03]],
    "home to": [["the", 0.70], ["millions", 0.20]],
    "to the": [["Eiffel", 0.50], ["Louvre", 0.30], ["Seine", 0.12]],
    "the Eiffel": [["Tower", 0.97]],
    "Eiffel Tower": [[".", 0.80], [",", 0.15]],
  };
  let toks = start.slice();
  const cands = () => table[toks.slice(-2).join(" ")] || [["…", 0.5], [".", 0.3], ["and", 0.2]];
  const atEnd = () => toks[toks.length - 1] === "." && toks[toks.length - 2] === "Tower";
  function render() {
    el.innerHTML =
      `<div class="readout">text so far: <b>${toks.join(" ")}</b></div>` +
      `<div style="margin:8px 0;font-size:13px;color:var(--muted)">top next-token guesses — click one to append (that's the entire loop):</div>` +
      cands().map((x, i) => `<button class="opt nt" data-i="${i}" style="display:inline-block;width:auto;margin:4px 6px 4px 0">${x[0]} <span style="color:var(--muted)">${Math.round(x[1] * 100)}%</span></button>`).join("") +
      `<div style="margin-top:10px"><button class="opt" id="ntauto" style="display:inline-block;width:auto">⏵ auto-write</button> <button class="opt" id="ntreset" style="display:inline-block;width:auto">↺ reset</button></div>` +
      `<div style="font-size:12px;color:var(--muted);margin-top:10px">Heads up: this is a tiny canned lookup that peeks at the last word or two — <b>not</b> a real network. A real GPT attends to the <em>whole</em> history (every chapter so far), which is exactly why it stays coherent instead of looping.</div>`;
    el.querySelectorAll(".nt").forEach((b) => b.addEventListener("click", () => { toks.push(cands()[+b.dataset.i][0]); render(); }));
    el.querySelector("#ntauto").addEventListener("click", () => { let g = 0; while (!atEnd() && g++ < 16) toks.push(cands()[0][0]); render(); });
    el.querySelector("#ntreset").addEventListener("click", () => { toks = start.slice(); render(); });
  }
  render();
}

// Two draggable-by-slider 2D vectors; live cosine + angle. Ties to LSA chapter.
function cosineWidget(el) {
  el.innerHTML = `
    <svg width="320" height="240" viewBox="0 0 320 240"></svg>
    <div><label>vector A angle</label><input id="a-ang" type="range" min="0" max="360" value="20"></div>
    <div><label>vector B angle</label><input id="b-ang" type="range" min="0" max="360" value="75"></div>
    <div class="readout">cosine similarity = <b id="cos">—</b> &nbsp; (angle between = <b id="deg">—</b>°)</div>`;
  const svg = el.querySelector("svg");
  const cx = 160, cy = 130, R = 95;
  function draw() {
    const a = (+el.querySelector("#a-ang").value) * Math.PI / 180;
    const b = (+el.querySelector("#b-ang").value) * Math.PI / 180;
    const va = [Math.cos(a), -Math.sin(a)], vb = [Math.cos(b), -Math.sin(b)];
    const cos = va[0] * vb[0] + va[1] * vb[1];           // unit vectors ⇒ dot = cosine
    const deg = Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
    const arrow = (v, color, lbl) =>
      `<line x1="${cx}" y1="${cy}" x2="${cx + v[0] * R}" y2="${cy + v[1] * R}" stroke="${color}" stroke-width="3"/>` +
      `<circle cx="${cx + v[0] * R}" cy="${cy + v[1] * R}" r="5" fill="${color}"/>` +
      `<text x="${cx + v[0] * (R + 16)}" y="${cy + v[1] * (R + 16)}" fill="${color}" font-size="13" text-anchor="middle">${lbl}</text>`;
    svg.innerHTML =
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#d1d5db"/>` +
      arrow(va, "#2563eb", "A") + arrow(vb, "#7c3aed", "B");
    el.querySelector("#cos").textContent = cos.toFixed(3);
    el.querySelector("#deg").textContent = deg;
  }
  el.querySelectorAll("input").forEach((i) => i.addEventListener("input", draw));
  draw();
}

// Toy self-attention: pick a query word, see softmax weights over the others.
// Weights are illustrative (hand-set affinities), not a real model — the point
// is the *shape* of attention: one token weighting all others.
function attentionWidget(el) {
  const toks = ["I", "sat", "on", "the", "river", "bank"];
  // per-QUERY affinity rows — the whole point is that the distribution changes
  // with the query ("sat" looks at its subject, "bank" looks at "river")
  const affin = {
    I:     { I: 1.0, sat: 1.2, on: 0.2, the: 0.2, river: 0.2, bank: 0.2 },
    sat:   { I: 1.6, sat: 1.0, on: 0.7, the: 0.2, river: 0.2, bank: 0.2 },
    on:    { I: 0.2, sat: 1.0, on: 1.0, the: 0.9, river: 0.2, bank: 0.2 },
    the:   { I: 0.2, sat: 0.2, on: 0.7, the: 1.0, river: 1.2, bank: 1.2 },
    river: { I: 0.2, sat: 0.2, on: 0.2, the: 0.8, river: 1.0, bank: 2.0 },
    bank:  { I: 0.2, sat: 0.2, on: 0.2, the: 0.9, river: 2.6, bank: 1.0 },
  };
  el.innerHTML = `<div class="readout">Query word: <b id="qword">bank</b> — how much it attends to each token (softmax):</div><svg width="360" height="120"></svg>
    <div style="font-size:12px;color:var(--muted)">Click a token to make it the query.</div>`;
  const svg = el.querySelector("svg");
  function draw(query) {
    el.querySelector("#qword").textContent = query;
    const base = toks.map((t) => affin[query][t]);
    const ex = base.map((x) => Math.exp(x));
    const sum = ex.reduce((s, x) => s + x, 0);
    const w = ex.map((x) => x / sum);
    const bw = 50, gap = 8;
    svg.innerHTML = toks.map((t, i) => {
      const h = 8 + w[i] * 80, x = 10 + i * (bw + gap);
      const isq = t === query;
      return `<rect class="atok" data-t="${t}" x="${x}" y="${100 - h}" width="${bw}" height="${h}" rx="4" fill="${isq ? "#b45309" : "#2563eb"}" opacity="${0.35 + w[i]}" style="cursor:pointer"/>` +
        `<text x="${x + bw / 2}" y="114" fill="#6b7280" font-size="12" text-anchor="middle">${t}</text>` +
        `<text x="${x + bw / 2}" y="${96 - h}" fill="#1f2937" font-size="11" text-anchor="middle">${w[i].toFixed(2)}</text>`;
    }).join("");
    svg.querySelectorAll(".atok").forEach((r) => r.addEventListener("click", () => draw(r.dataset.t)));
  }
  draw("bank");
}

// L0 — the distributional hypothesis, concretely: a word is known by the company
// it keeps. Pick a word, see the words that surround it, and watch how much of
// that company it SHARES with the others. cat & dog keep nearly the same company
// → a machine calls them similar, with no idea what either means. car shares
// nothing → it's unrelated. No mystery, no scoring game: just shared company.
function distribWidget(el) {
  const company = {
    cat: ["purrs", "feed", "vet", "pet"],
    dog: ["barks", "feed", "vet", "pet", "leash"],
    car: ["drive", "fuel", "road"],
  };
  const pool = ["purrs", "barks", "feed", "vet", "pet", "leash", "drive", "fuel", "road"];
  const words = Object.keys(company);
  let sel = "cat";
  const shared = (a, b) => company[a].filter((c) => company[b].includes(c));
  function draw() {
    const mine = company[sel];
    const tabs = words.map((w) =>
      `<button class="opt ${w === sel ? "on" : ""}" data-w="${w}" style="display:inline-block;width:auto;margin:0 6px 0 0">${w}</button>`).join("");
    const chips = pool.map((c) => {
      const on = mine.includes(c);
      return `<span style="display:inline-block;margin:3px;padding:3px 9px;border-radius:6px;font-size:13px;border:1px solid ${on ? "#2563eb" : "#e5e7eb"};background:${on ? "rgba(37,99,235,.10)" : "transparent"};color:${on ? "#1f2937" : "#9ca3af"}">${c}</span>`;
    }).join("");
    const bars = words.filter((w) => w !== sel).map((w) => {
      const sh = shared(sel, w), n = sh.length, max = Math.max(mine.length, company[w].length);
      return `<div style="display:flex;align-items:center;gap:10px;margin:7px 0">
        <span style="width:62px;color:#6b7280;font-family:ui-monospace,monospace;font-size:13px">${sel} ↔ ${w}</span>
        <div style="flex:1;background:#e5e7eb;border-radius:4px;height:16px;overflow:hidden"><div style="width:${(n / max) * 100}%;height:100%;background:${n ? "#15803d" : "#d1d5db"};transition:.2s"></div></div>
        <span style="flex:none;width:170px;text-align:right;color:#374151;font-size:12px">${n ? n + " shared · " + sh.join(", ") : "nothing in common"}</span></div>`;
    }).join("");
    const sims = words.filter((x) => x !== sel).map((x) => ({ x, n: shared(sel, x).length })).sort((a, b) => b.n - a.n);
    const readout = sims[0].n === 0
      ? `<b>${sel}</b> keeps company nobody else does → it stands alone.`
      : `<b>${sel}</b> keeps almost the same company as <b style="color:var(--accent)">${sims[0].x}</b> → the machine calls them <b>similar</b>, without knowing what either <em>means</em>.`;
    el.innerHTML =
      `<div style="font-size:13px;color:#6b7280;margin-bottom:10px">Pick a word. Highlighted below is <b style="color:#374151">the company it keeps</b> — the words seen near it. A machine sees only this, never a definition.</div>` +
      tabs +
      `<div style="margin:14px 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">company of “${sel}”</div>` +
      `<div>${chips}</div>` +
      `<div style="font-size:13px;color:#6b7280;margin:16px 0 2px">company shared with the other words:</div>` +
      bars +
      `<div class="readout" style="margin-top:10px">${readout}</div>`;
    el.querySelectorAll(".opt[data-w]").forEach((b) => b.onclick = () => { sel = b.dataset.w; draw(); });
  }
  draw();
}

// L2 — "learned, not counted." Shows the actual machine: the word "dog" feeds a
// little neural net whose FIRST layer is its embedding — a row of 5 numbers
// ("knobs"). Each train step nudges those numbers (gradient descent) so the net
// predicts dog's real neighbours better; the numbers change, the output bars
// rise, the loss falls. Counting sets the numbers once; learning keeps tuning.
function trainvecWidget(el) {
  const MONO = "ui-monospace, Menlo, monospace";
  const start = [0.40, -0.20, 0.80, 0.10, -0.50];
  const tgt = [-0.30, 0.60, 0.20, -0.40, 0.50];     // the vector that predicts well
  const outs = [["vet", 0.45], ["feed", 0.30], ["pet", 0.18], ["drive", 0.07]];
  const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  const d0 = dist(start, tgt);
  let vec = start.slice(), steps = 0;
  function step(n) {
    for (let k = 0; k < n; k++) { for (let i = 0; i < 5; i++) vec[i] += (tgt[i] - vec[i]) * 0.18; steps++; }
    draw();
  }
  function cellColor(v) {                            // blue for +, violet for −, brighter = bigger
    const m = Math.min(1, Math.abs(v)), c = v >= 0 ? [37, 99, 235] : [124, 58, 237];
    return `rgba(${c[0]},${c[1]},${c[2]},${(0.16 + m * 0.7).toFixed(2)})`;
  }
  function draw() {
    const loss = dist(vec, tgt), p = Math.max(0, Math.min(1, 1 - loss / d0));
    const W = 460, H = 296, ex = 86, ew = 46, eh = 30, eg = 8, ey0 = 46;
    const ecy = (i) => ey0 + i * (eh + eg) + eh / 2, hx = 252, ox = 326;
    const hy = [74, 120, 166, 212], oy = [74, 120, 166, 212];
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;height:auto">`;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++)            // embedding → hidden
      s += `<line x1="${ex + ew}" y1="${ecy(i)}" x2="${hx}" y2="${hy[j]}" stroke="#2563eb" stroke-width="1" opacity="${(0.05 + p * 0.13).toFixed(2)}"/>`;
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++)            // hidden → output
      s += `<line x1="${hx}" y1="${hy[j]}" x2="${ox}" y2="${oy[k]}" stroke="#7c3aed" stroke-width="1" opacity="${(0.05 + p * 0.13).toFixed(2)}"/>`;
    s += `<rect x="6" y="${ecy(2) - 21}" width="56" height="42" rx="8" fill="#f3f4f6" stroke="#d1d5db"/><text x="34" y="${ecy(2) + 1}" fill="#1f2937" font-size="14" text-anchor="middle">dog</text><text x="34" y="${ecy(2) + 16}" fill="#9ca3af" font-size="9" text-anchor="middle">token</text>`;
    s += `<text x="${ex + ew / 2}" y="34" fill="#6b7280" font-size="10" text-anchor="middle">embedding · 5 knobs</text>`;
    for (let i = 0; i < 5; i++) {
      s += `<rect x="${ex}" y="${ey0 + i * (eh + eg)}" width="${ew}" height="${eh}" rx="5" fill="${cellColor(vec[i])}" stroke="#d1d5db"/>`;
      s += `<text x="${ex + ew / 2}" y="${ecy(i) + 4}" fill="#1f2937" font-size="12" font-family="${MONO}" text-anchor="middle">${vec[i].toFixed(2)}</text>`;
    }
    s += `<text x="${hx}" y="34" fill="#6b7280" font-size="10" text-anchor="middle">hidden</text>`;
    for (let j = 0; j < 4; j++) s += `<circle cx="${hx}" cy="${hy[j]}" r="9" fill="#ffffff" stroke="#2563eb" stroke-opacity="${(0.4 + p * 0.6).toFixed(2)}"/>`;
    s += `<text x="${ox + 56}" y="34" fill="#6b7280" font-size="10" text-anchor="middle">predicts neighbour</text>`;
    outs.forEach((o, k) => {
      const prob = (1 - p) * 0.25 + p * o[1];
      s += `<text x="${ox - 6}" y="${oy[k] + 4}" fill="#374151" font-size="11" text-anchor="end">${o[0]}</text>`;
      s += `<rect x="${ox + 2}" y="${oy[k] - 7}" width="96" height="14" rx="3" fill="#e5e7eb"/>`;
      s += `<rect x="${ox + 2}" y="${oy[k] - 7}" width="${(96 * prob).toFixed(1)}" height="14" rx="3" fill="${k < 3 ? "#15803d" : "#d1d5db"}"/>`;
      s += `<text x="${ox + 104}" y="${oy[k] + 4}" fill="#6b7280" font-size="10" font-family="${MONO}">${Math.round(prob * 100)}%</text>`;
    });
    s += `</svg>`;
    el.innerHTML = s +
      `<div class="readout">steps: <b>${steps}</b> &nbsp; loss: <b>${loss.toFixed(2)}</b></div>
       <div style="margin-top:10px">
        <button class="opt" id="s1" style="display:inline-block;width:auto">▶ train 1 step</button>
        <button class="opt" id="s10" style="display:inline-block;width:auto">⏩ train 10×</button>
        <button class="opt" id="sr" style="display:inline-block;width:auto">↺ reset</button></div>
       <div style="font-size:12px;color:#6b7280;margin-top:8px">Those 5 numbers <em>are</em> the word's vector — knobs the net turns. Each step nudges them so it predicts <code>dog</code>'s real neighbours better, and the loss falls. Counting sets the numbers once; learning keeps tuning them.</div>`;
    el.querySelector("#s1").onclick = () => step(1);
    el.querySelector("#s10").onclick = () => step(10);
    el.querySelector("#sr").onclick = () => { vec = start.slice(); steps = 0; draw(); };
  }
  draw();
}

// L3 — meaning has directions you can do arithmetic on. Pick A − B + C; the
// nearest real word pops out. king − man + woman → queen, because "gender" and
// "status" became directions in the space — learned, not programmed.
function analogyWidget(el) {
  // toy 2-D space: x = gender, y = status. Positions are tuned so the vector
  // arithmetic actually lands right: the "royalty" offset (king − man) added to
  // girl reaches princess, to boy reaches prince, to woman reaches queen.
  const emb = {
    boy: [0.12, 0.12], girl: [0.88, 0.12],
    man: [0.12, 0.36], woman: [0.88, 0.36],
    prince: [0.12, 0.66], princess: [0.88, 0.66],
    king: [0.12, 0.90], queen: [0.88, 0.90],
  };
  const words = Object.keys(emb);
  let A = "king", B = "man", C = "woman";
  const W = 340, H = 250, pad = 32;
  const X = (v) => pad + v * (W - 2 * pad), Y = (v) => H - pad - v * (H - 2 * pad);
  function nearest(t, ex) {
    let best = null, bd = 1e9;
    for (const w of words) { if (ex.includes(w)) continue; const d = Math.hypot(emb[w][0] - t[0], emb[w][1] - t[1]); if (d < bd) { bd = d; best = w; } }
    return best;
  }
  function draw() {
    const t = [emb[A][0] - emb[B][0] + emb[C][0], emb[A][1] - emb[B][1] + emb[C][1]];
    const ans = nearest(t, [A, B, C]);
    const dot = (w, col) => `<circle cx="${X(emb[w][0])}" cy="${Y(emb[w][1])}" r="5" fill="${col}"/><text x="${X(emb[w][0]) + 8}" y="${Y(emb[w][1]) + 4}" fill="${col}" font-size="12">${w}</text>`;
    let pts = words.map((w) => dot(w, [A, B, C].includes(w) ? "#b45309" : "#9ca3af")).join("");
    pts += `<circle cx="${X(t[0])}" cy="${Y(t[1])}" r="8" fill="none" stroke="#2563eb" stroke-width="2"/><text x="${X(t[0]) + 11}" y="${Y(t[1]) - 9}" fill="#2563eb" font-size="12">result</text>`;
    const sel = (id, val) => `<select id="${id}" class="wsel">${words.map((w) => `<option ${w === val ? "selected" : ""}>${w}</option>`).join("")}</select>`;
    el.innerHTML =
      `<div class="readout" style="margin-bottom:8px">${sel("aA", A)} − ${sel("aB", B)} + ${sel("aC", C)} = <b>${ans}</b></div>
       <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;height:auto">
         <text x="${W / 2}" y="${H - 6}" fill="#9ca3af" font-size="11" text-anchor="middle">← male · gender · female →</text>
         <text x="13" y="${H / 2}" fill="#9ca3af" font-size="11" transform="rotate(-90 13 ${H / 2})" text-anchor="middle">status →</text>${pts}
       </svg>
       <div style="font-size:12px;color:#6b7280;margin-top:6px">Nobody drew these axes — "gender" and "status" <em>emerged</em> as directions, just from predicting word neighbours.</div>`;
    el.querySelector("#aA").onchange = (e) => { A = e.target.value; draw(); };
    el.querySelector("#aB").onchange = (e) => { B = e.target.value; draw(); };
    el.querySelector("#aC").onchange = (e) => { C = e.target.value; draw(); };
  }
  draw();
}

// L4 — the static-embedding flaw, made visible. "bank" gets ONE fixed vector, so
// it's frozen halfway between river-words and money-words — a blur fitting
// neither sentence. The dashed blue target shows where a context-aware model
// would put it; the red dot can't follow.
function polysemyWidget(el) {
  const W = 360, H = 210;
  const river = { x: 72, y: 72 }, money = { x: 288, y: 72 }, stuck = { x: 180, y: 150 };
  let ctx = "river";
  function draw() {
    const want = ctx === "river" ? river : money;
    el.innerHTML =
      `<div style="margin-bottom:10px">
        <button class="opt ${ctx === "river" ? "on" : ""}" data-c="river" style="display:inline-block;width:auto">"…the river <b>bank</b>"</button>
        <button class="opt ${ctx === "money" ? "on" : ""}" data-c="money" style="display:inline-block;width:auto">"…the cash <b>bank</b>"</button></div>
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;height:auto">
        <circle cx="${river.x}" cy="${river.y}" r="36" fill="rgba(21,128,61,.08)" stroke="#15803d" stroke-dasharray="3 3"/>
        <text x="${river.x}" y="${river.y + 4}" fill="#15803d" font-size="11" text-anchor="middle">river</text>
        <circle cx="${money.x}" cy="${money.y}" r="36" fill="rgba(180,83,9,.08)" stroke="#b45309" stroke-dasharray="3 3"/>
        <text x="${money.x}" y="${money.y + 4}" fill="#b45309" font-size="11" text-anchor="middle">money</text>
        <line x1="${stuck.x}" y1="${stuck.y}" x2="${want.x}" y2="${want.y}" stroke="#dc2626" stroke-dasharray="2 3" opacity=".45"/>
        <circle cx="${want.x}" cy="${want.y}" r="9" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="3 3"/>
        <text x="${want.x}" y="${want.y - 15}" fill="#2563eb" font-size="10" text-anchor="middle">where it should be</text>
        <circle cx="${stuck.x}" cy="${stuck.y}" r="8" fill="#dc2626"/>
        <text x="${stuck.x}" y="${stuck.y + 22}" fill="#dc2626" font-size="11" text-anchor="middle">static "bank" — stuck</text>
      </svg>
      <div style="font-size:12px;color:#6b7280;margin-top:6px">Switch the sentence: the blue target jumps, but the red static vector <b>can't move</b>. One word, one vector, blind to context — the flaw the next chapters fix.</div>`;
    el.querySelectorAll(".opt[data-c]").forEach((b) => b.onclick = () => { ctx = b.dataset.c; draw(); });
  }
  draw();
}

// L7 — masked language modelling: hide a word, predict it from BOTH sides. Toggle
// the right context off to feel why bidirectional wins — the right side is what
// disambiguates the blank.
function maskfillWidget(el) {
  const left = "I sat on the", right = "and watched the water", answer = "river";
  const both = [["river", 0.71], ["canal", 0.10], ["far", 0.05]];
  const leftOnly = [["bus", 0.18], ["floor", 0.15], ["river", 0.14]];
  let bidir = true;
  function draw() {
    const c = bidir ? both : leftOnly;
    const rt = bidir ? right : `<span style="opacity:.22">${right}</span>`;
    const bars = c.map(([w, p]) =>
      `<div style="display:flex;align-items:center;gap:10px;margin:5px 0">
        <span style="width:54px;color:#374151;font-family:var(--mono)">${w}</span>
        <div style="flex:1;background:#e5e7eb;border-radius:4px;height:15px;overflow:hidden"><div style="width:${p * 100}%;height:100%;background:${w === answer ? "#15803d" : "#d1d5db"}"></div></div>
        <span style="width:34px;text-align:right;color:#6b7280">${Math.round(p * 100)}%</span></div>`).join("");
    el.innerHTML =
      `<div class="readout" style="font-size:16px;margin-bottom:12px">${left} <span style="color:#b45309;border:1px dashed #b45309;padding:1px 8px;border-radius:4px">[MASK]</span> ${rt}.</div>
       <div style="margin-bottom:10px"><button class="opt ${bidir ? "on" : ""}" id="mb" style="display:inline-block;width:auto">see both sides (BERT)</button>
       <button class="opt ${bidir ? "" : "on"}" id="ml" style="display:inline-block;width:auto">hide the right side</button></div>${bars}
       <div style="font-size:12px;color:#6b7280;margin-top:8px">${bidir ? "With the right side visible, <b style='color:#15803d'>river</b> is obvious." : "Without it, the model is guessing — that's why reading <em>both</em> directions is the point of BERT."}</div>`;
    el.querySelector("#mb").onclick = () => { bidir = true; draw(); };
    el.querySelector("#ml").onclick = () => { bidir = false; draw(); };
  }
  draw();
}

// L8 — many word vectors become one sentence vector by averaging (mean-pooling).
// Toggle words in and out; the bold summary arrow swings to their average.
function poolWidget(el) {
  const W = 320, H = 230, cx = 55, cy = 195, R = 150;
  const words = [{ w: "fast", a: 16 }, { w: "secure", a: 36 }, { w: "login", a: 58 }, { w: "code", a: 80 }].map((x) => ({ ...x, on: true }));
  function draw() {
    const on = words.filter((x) => x.on);
    let mx = 0, my = 0;
    on.forEach((x) => { mx += Math.cos(x.a * Math.PI / 180); my += Math.sin(x.a * Math.PI / 180); });
    if (on.length) { mx /= on.length; my /= on.length; }
    let svg = on.map((x) => {
      const ex = cx + Math.cos(x.a * Math.PI / 180) * R, ey = cy - Math.sin(x.a * Math.PI / 180) * R;
      return `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="#9ca3af" stroke-width="2"/><text x="${ex + 4}" y="${ey}" fill="#9ca3af" font-size="12">${x.w}</text>`;
    }).join("");
    if (on.length) {
      const ma = Math.atan2(my, mx), ml = Math.hypot(mx, my);
      const ex = cx + Math.cos(ma) * R * ml, ey = cy - Math.sin(ma) * R * ml;
      svg += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="#2563eb" stroke-width="4"/><circle cx="${ex}" cy="${ey}" r="5" fill="#2563eb"/><text x="${ex + 6}" y="${ey - 4}" fill="#2563eb" font-size="13">sentence</text>`;
    }
    const chips = words.map((x, i) => `<button class="opt ${x.on ? "on" : ""}" data-i="${i}" style="display:inline-block;width:auto;margin:3px 6px 3px 0">${x.w}</button>`).join("");
    el.innerHTML =
      `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;height:auto">${svg}</svg>
       <div style="font-size:13px;color:#6b7280;margin:6px 0">Toggle words; the bold <b style="color:#2563eb">sentence vector</b> is their average:</div>${chips}
       <div style="font-size:12px;color:#6b7280;margin-top:8px">Mean-pooling collapses a whole sentence to one point you can compare by cosine — LSA's 1990 trick again, on far smarter inputs.</div>`;
    el.querySelectorAll(".opt[data-i]").forEach((b) => b.onclick = () => { words[+b.dataset.i].on = !words[+b.dataset.i].on; draw(); });
  }
  draw();
}

// L9 — same self-attention, two jobs. Encoder: a token reads every token (full
// context, for understanding). Decoder: a token reads only the past (so it can
// write the next word without peeking). Click a token; toggle the mode.
function twinsWidget(el) {
  const toks = ["the", "cat", "sat", "on", "mat"];
  let mode = "encoder", focus = 2;
  const W = 360, H = 150, x0 = 34, gap = (W - 68) / (toks.length - 1), y = 105;
  function draw() {
    const xs = toks.map((_, i) => x0 + i * gap);
    let arcs = "";
    toks.forEach((_, j) => {
      if (j === focus) return;
      if (mode === "decoder" && j > focus) return;     // causal mask: no reading the future
      const x1 = xs[focus], x2 = xs[j], mx = (x1 + x2) / 2, h = y - 26 - Math.abs(x1 - x2) * 0.16;
      arcs += `<path d="M${x1} ${y - 9} Q ${mx} ${h} ${x2} ${y - 9}" fill="none" stroke="#2563eb" stroke-width="1.6" opacity=".75" marker-end="url(#ah)"/>`;
    });
    const dots = toks.map((t, i) =>
      `<circle cx="${xs[i]}" cy="${y}" r="7" fill="${i === focus ? "#b45309" : "#f3f4f6"}" stroke="${i === focus ? "#b45309" : "#d1d5db"}" style="cursor:pointer" data-i="${i}"/><text x="${xs[i]}" y="${y + 24}" fill="#6b7280" font-size="12" text-anchor="middle">${t}</text>`).join("");
    el.innerHTML =
      `<div style="margin-bottom:10px"><button class="opt ${mode === "encoder" ? "on" : ""}" data-m="encoder" style="display:inline-block;width:auto">Encoder · understand (BERT)</button>
       <button class="opt ${mode === "decoder" ? "on" : ""}" data-m="decoder" style="display:inline-block;width:auto">Decoder · write (GPT)</button></div>
       <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;height:auto">
         <defs><marker id="ah" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#2563eb"/></marker></defs>${arcs}${dots}
       </svg>
       <div style="font-size:12px;color:#6b7280;margin-top:6px">Click a token to focus it. ${mode === "encoder" ? "Encoder reads <b>both</b> sides — full context to understand." : "Decoder reads only the <b>past</b> — so it can predict the next word without cheating."}</div>`;
    el.querySelectorAll(".opt[data-m]").forEach((b) => b.onclick = () => { mode = b.dataset.m; draw(); });
    el.querySelectorAll("circle[data-i]").forEach((c) => c.onclick = () => { focus = +c.dataset.i; draw(); });
  }
  draw();
}

// L10 — there are no "words" inside the model, only tokens. Type anything; a toy
// greedy subword splitter chunks it the way BPE does: common strings stay whole,
// rare ones shatter into pieces, nothing is ever out-of-vocabulary.
function bpeWidget(el) {
  const vocab = ["▁the", "▁token", "izing", "▁low", "est", "er", "▁new", "▁is", "▁fun", "▁under", "stand", "ing", "tion", "▁a", "ly", "ed", "s"];
  const colors = ["#2563eb", "#7c3aed", "#15803d", "#b45309", "#c2410c", "#0e7490"];
  function tokenize(text) {
    const out = [];
    text.trim().split(/\s+/).filter(Boolean).forEach((word) => {
      let s = "▁" + word.toLowerCase();
      while (s.length) {
        let m = "";
        for (const v of vocab) if (s.startsWith(v) && v.length > m.length) m = v;
        if (!m) { out.push(s[0]); s = s.slice(1); }     // single-char fallback — never OOV
        else { out.push(m); s = s.slice(m.length); }
      }
    });
    return out;
  }
  el.innerHTML = `<input id="bpein" class="wtext" value="the tokenizing is fun understanding lowest" /><div id="bpeout"></div>`;
  const inp = el.querySelector("#bpein"), out = el.querySelector("#bpeout");
  function render() {
    const toks = tokenize(inp.value);
    const nWords = inp.value.trim().split(/\s+/).filter(Boolean).length;
    const chips = toks.map((t, i) => {
      const col = colors[i % colors.length];
      return `<span style="display:inline-block;margin:2px;padding:2px 7px;border-radius:5px;font-family:var(--mono);font-size:13px;background:${col}22;border:1px solid ${col};color:#1f2937">${t.replace("▁", "·")}</span>`;
    }).join("");
    out.innerHTML =
      `<div style="margin:12px 0;min-height:28px">${chips}</div>
       <div class="readout"><b>${toks.length}</b> tokens · ${nWords} words</div>
       <div style="font-size:12px;color:#6b7280;margin-top:6px">"·" marks a word start. Common chunks stay whole; rare ones split. The model's real unit is the token, not the word — which is why it can miscount the letters in "strawberry".</div>`;
  }
  inp.oninput = render; render();
}

// L12 — scale as a dial. Slide the model size: a smooth loss drop, but specific
// skills "switch on" at thresholds (emergence). The Chinchilla readout shows the
// matching training data a model that size actually needs (~20 tokens/param).
function scalingWidget(el) {
  const skills = [
    { s: "grammar", at: 1e7 }, { s: "world facts", at: 3e8 }, { s: "arithmetic", at: 6e9 },
    { s: "writing code", at: 2e10 }, { s: "step-by-step reasoning", at: 1.5e11 },
  ];
  const min = 1e7, max = 5e11;
  const fmt = (n) => n >= 1e12 ? (n / 1e12).toFixed(1) + "T" : n >= 1e9 ? (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(0) + "M" : "" + Math.round(n);
  el.innerHTML =
    `<div><label style="width:auto">model size</label> <input id="scl" type="range" min="0" max="1000" value="520" style="width:58%;vertical-align:middle"></div><div id="sclout" style="margin-top:12px"></div>`;
  const sl = el.querySelector("#scl"), out = el.querySelector("#sclout");
  function render() {
    const params = min * Math.pow(max / min, sl.value / 1000);   // log-scaled slider
    const tokens = params * 20;
    const rows = skills.map((k) => {
      const on = params >= k.at;
      return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;opacity:${on ? 1 : .4}">
        <span style="color:${on ? "#15803d" : "#9ca3af"}">${on ? "●" : "○"}</span>
        <span style="color:#374151">${k.s}</span>
        <span style="color:#9ca3af;font-size:12px">${on ? "" : "unlocks ~" + fmt(k.at)}</span></div>`;
    }).join("");
    out.innerHTML =
      `<div class="readout">size: <b>${fmt(params)}</b> params → Chinchilla data: <b>${fmt(tokens)}</b> tokens</div>
       <div style="margin:12px 0">${rows}</div>
       <div style="font-size:12px;color:#6b7280">Loss falls smoothly, but skills appear in jumps — <em>emergence</em>. And size alone isn't enough: a model this big needs ~${fmt(tokens)} tokens or it's starved (the Chinchilla correction).</div>`;
  }
  sl.oninput = render; render();
}

// L13 — how a raw predictor becomes an assistant. Rank the answers best→worst by
// clicking in order; a reward model turns the ranking into scores, and the LLM is
// steered to produce more of the top-ranked style.
function rlhfWidget(el) {
  const prompt = "What's the capital of France?";
  const answers = [
    { t: "Paris.", k: "helpful" },
    { t: "What's the capital of Spain? Of Italy?", k: "just continues the pattern" },
    { t: "I couldn't possibly say.", k: "unhelpful refusal" },
  ];
  let order = [];
  function render() {
    const ranked = order.length === answers.length;
    const cards = answers.map((a, i) => {
      const rank = order.indexOf(i), reward = ranked ? answers.length - rank : null;
      return `<div class="opt" data-i="${i}" style="display:block;width:100%;cursor:${order.includes(i) ? "default" : "pointer"};${rank === 0 ? "border-color:#15803d" : ""}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <span>${a.t} <span style="color:#9ca3af;font-size:12px">— ${a.k}</span></span>
          <span style="font-family:var(--mono);color:${rank === 0 ? "#15803d" : "#6b7280"};white-space:nowrap">${order.includes(i) ? "#" + (rank + 1) : "rank?"}${reward != null ? ` · +${reward}` : ""}</span></div></div>`;
    }).join("");
    el.innerHTML =
      `<div style="font-size:13px;color:#6b7280;margin-bottom:8px">Prompt: <b style="color:#374151">${prompt}</b></div>
       <div style="font-size:12px;color:#6b7280;margin-bottom:10px">${ranked ? "Reward model learned your preference ↓" : "Click the answers best → worst:"}</div>${cards}
       <div style="margin-top:10px"><button class="opt" id="rr" style="display:inline-block;width:auto">↺ reset</button></div>
       ${ranked ? `<div class="readout" style="margin-top:8px">LLM now steered toward → <b>${answers[order[0]].t}</b></div><div style="font-size:12px;color:#6b7280;margin-top:4px">Same engine underneath — just <em>aimed</em> at what people prefer. That's RLHF.</div>` : ""}`;
    el.querySelectorAll(".opt[data-i]").forEach((c) => c.onclick = () => { const i = +c.dataset.i; if (!order.includes(i)) { order.push(i); render(); } });
    el.querySelector("#rr").onclick = () => { order = []; render(); };
  }
  render();
}

// L14 — test-time compute. Slide the thinking budget: with more room to work the
// chain of thought grows and accuracy climbs (diminishing returns). A new knob,
// separate from model size or training length. (The bat-and-ball trap: gut says
// 10¢, the answer is 5¢.)
function thinkWidget(el) {
  const steps = [
    "10¢.",
    "Feels like 10¢. Check: then the bat is 10¢ + $1 = $1.10, total $1.20 — too high.",
    "Let ball = b, bat = b + $1.\nb + (b + 1) = 1.10  →  2b = 0.10  →  b = $0.05.\nAnswer: 5¢.",
    "Let ball = b, bat = b + $1.\nb + (b + 1) = 1.10  →  2b = 0.10  →  b = $0.05.\nCheck: bat $1.05 + ball $0.05 = $1.10 ✓.\nAnswer: 5¢ (not the gut answer, 10¢).",
  ];
  const tok = [0, 40, 170, 380], acc = [22, 41, 88, 97];
  el.innerHTML =
    `<div style="font-size:13px;color:#6b7280;margin-bottom:8px">A bat and a ball cost $1.10. The bat costs $1 more than the ball. <b style="color:#374151">How much is the ball?</b></div>
     <div><label style="width:auto">thinking budget</label> <input id="thk" type="range" min="0" max="3" value="0" style="width:52%;vertical-align:middle"></div><div id="thkout" style="margin-top:12px"></div>`;
  const sl = el.querySelector("#thk"), out = el.querySelector("#thkout");
  function render() {
    const n = +sl.value;
    out.innerHTML =
      `<div class="readout" style="margin-bottom:8px">tokens to think: <b>${tok[n]}</b> &nbsp; accuracy: <b>${acc[n]}%</b></div>
       <div style="background:#e5e7eb;border-radius:4px;height:10px;overflow:hidden;margin-bottom:12px"><div style="width:${acc[n]}%;height:100%;background:#15803d;transition:.2s"></div></div>
       <div style="background:#e5e7eb;border:1px solid #d1d5db;border-radius:8px;padding:12px;font-family:var(--mono);font-size:13px;color:#374151;white-space:pre-wrap;min-height:2em">${steps[n]}</div>
       <div style="font-size:12px;color:#6b7280;margin-top:8px">More room to think → it catches its own mistake. Reasoning wasn't programmed; rewarding only <em>verified-correct</em> answers pressured it to emerge.</div>`;
  }
  sl.oninput = render; render();
}

// ---- nav ----
document.getElementById("prev").addEventListener("click", () => { if (current > 0) { current--; render(); } });
document.getElementById("next").addEventListener("click", () => { if (current < LESSONS.length - 1) { current++; render(); } });
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") document.getElementById("prev").click();
  if (e.key === "ArrowRight") document.getElementById("next").click();
});

render();
