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

function renderBody(body) {
  return body.map((s) => {
    if (s.p) return `<p class="${s.lead ? "lead" : ""}">${s.p}</p>`;
    if (s.h) return `<h3>${s.h}</h3>`;
    if (s.eq) return `<code class="eq">${s.eq.replace(/\n/g, "<br>")}</code>`;
    for (const k of ["desk", "leap", "aside", "legacy"]) {
      if (s[k]) return `<div class="callout ${k}"><div class="tag">${CALLOUT_LABEL[k]}</div>${s[k]}</div>`;
    }
    if (s.widget) return `<div class="widget" data-widget="${s.widget}"></div>`;
    return "";
  }).join("");
}

function renderQuiz(quiz, li) {
  if (!quiz || !quiz.length) return "";
  const items = quiz.map((q, qi) => {
    const opts = q.options.map((o, oi) =>
      `<button class="opt" data-li="${li}" data-qi="${qi}" data-oi="${oi}">${o}</button>`).join("");
    return `<div class="q">${q.q}</div>${opts}<div class="explain" id="ex-${li}-${qi}"></div>`;
  }).join("");
  return `<div class="quiz"><h4>✦ Check yourself</h4>${items}</div>`;
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
function mountWidget(el) {
  if (el.dataset.widget === "cosine") return cosineWidget(el);
  if (el.dataset.widget === "attention") return attentionWidget(el);
  if (el.dataset.widget === "autoregress") return autoregressWidget(el);
}

// Toy autoregressive generator: predict→append→repeat, with canned top-k
// next-token guesses. Not a real model — it makes the *loop* tangible.
function autoregressWidget(el) {
  const start = ["The", "capital", "of", "France", "is"];
  const table = {
    "is": [["Paris", 0.82], ["a", 0.07], ["the", 0.05]],
    "Paris": [[".", 0.55], [",", 0.25], ["—", 0.08]],
    ".": [["It", 0.40], ["The", 0.22], ["Paris", 0.10]],
    "It": [["is", 0.5], ["has", 0.2], ["was", 0.15]],
    "has": [["a", 0.4], ["been", 0.2], ["many", 0.15]],
    "The": [["city", 0.4], ["Eiffel", 0.3], ["river", 0.1]],
  };
  let toks = start.slice();
  const cands = () => table[toks[toks.length - 1]] || [["…", 0.5], [".", 0.3], ["and", 0.2]];
  function render() {
    const c = cands();
    el.innerHTML =
      `<div class="readout">text so far: <b>${toks.join(" ")}</b></div>` +
      `<div style="margin:8px 0;font-size:13px;color:var(--muted)">model's top next-token guesses — click one to append (that's the entire loop):</div>` +
      c.map((x, i) => `<button class="opt nt" data-i="${i}" style="display:inline-block;width:auto;margin:4px 6px 4px 0">${x[0]} <span style="color:var(--muted)">${Math.round(x[1] * 100)}%</span></button>`).join("") +
      `<div style="margin-top:10px"><button class="opt" id="ntauto" style="display:inline-block;width:auto">⏵ auto-generate 5×</button> <button class="opt" id="ntreset" style="display:inline-block;width:auto">↺ reset</button></div>`;
    el.querySelectorAll(".nt").forEach((b) => b.addEventListener("click", () => { toks.push(cands()[+b.dataset.i][0]); render(); }));
    el.querySelector("#ntauto").addEventListener("click", () => { for (let k = 0; k < 5; k++) toks.push(cands()[0][0]); render(); });
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
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#2b3441"/>` +
      arrow(va, "#6ea8fe", "A") + arrow(vb, "#b692ff", "B");
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
  // affinity of "bank"(query) toward each token — high on river/the
  const affin = { I: 0.1, sat: 0.3, on: 0.2, the: 0.6, river: 2.4, bank: 0.5 };
  el.innerHTML = `<div class="readout">Query word: <b id="qword">bank</b> — how much it attends to each token (softmax):</div><svg width="360" height="120"></svg>
    <div style="font-size:12px;color:var(--muted)">Click a token to make it the query.</div>`;
  const svg = el.querySelector("svg");
  function draw(query) {
    el.querySelector("#qword").textContent = query;
    // crude affinity model: each token's pull toward the query
    const base = toks.map((t) => (t === query ? 1.0 : (affin[t] || 0.3)));
    const ex = base.map((x) => Math.exp(x));
    const sum = ex.reduce((s, x) => s + x, 0);
    const w = ex.map((x) => x / sum);
    const bw = 50, gap = 8;
    svg.innerHTML = toks.map((t, i) => {
      const h = 8 + w[i] * 80, x = 10 + i * (bw + gap);
      const isq = t === query;
      return `<rect class="atok" data-t="${t}" x="${x}" y="${100 - h}" width="${bw}" height="${h}" rx="4" fill="${isq ? "#e3b341" : "#6ea8fe"}" opacity="${0.35 + w[i]}" style="cursor:pointer"/>` +
        `<text x="${x + bw / 2}" y="114" fill="#8b949e" font-size="12" text-anchor="middle">${t}</text>` +
        `<text x="${x + bw / 2}" y="${96 - h}" fill="#e6edf3" font-size="11" text-anchor="middle">${w[i].toFixed(2)}</text>`;
    }).join("");
    svg.querySelectorAll(".atok").forEach((r) => r.addEventListener("click", () => draw(r.dataset.t)));
  }
  draw("bank");
}

// ---- nav ----
document.getElementById("prev").addEventListener("click", () => { if (current > 0) { current--; render(); } });
document.getElementById("next").addEventListener("click", () => { if (current < LESSONS.length - 1) { current++; render(); } });
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") document.getElementById("prev").click();
  if (e.key === "ArrowRight") document.getElementById("next").click();
});

render();
