# Interactive courses — how machines learned to understand

Short, hands-on, play-as-you-read courses on the ideas behind modern AI.
No build step, no dependencies — static HTML/CSS/JS.

**▶ Live: https://cs01.github.io/bite-size-embeddings/**

## Tracks

| path | course | what it is |
|------|--------|-----------|
| `/` | **Hub** | landing page linking the tracks |
| `/footsteps/` | **Footsteps** | how we taught machines meaning — Firth → embeddings → self-attention → RLHF. 13 chapters, live widgets, quizzes. Saves progress in `localStorage`. Deep-link a chapter with `#<n>` (e.g. `footsteps/#2`). |
| `/svd/` | **SVD Explorer** | singular value decomposition built bottom-up: vectors → eigenvectors → geometry → image compression. The math behind Footsteps ch.2 (LSA). |
| `/transcripts/` | reference | cleaned Stanford CS336 lecture transcripts, used to sanity-check coverage. Not part of the site. |

The two courses cross-link: Footsteps ch.2 → "go deeper" → SVD Explorer, and SVD Explorer → "back to the story" → Footsteps ch.2.

## Run locally

```sh
python3 -m http.server   # then open http://localhost:8000
```

## Footsteps internals

| file | role |
|------|------|
| `footsteps/index.html` | shell + script tags |
| `footsteps/styles.css` | styling (dark theme, responsive) |
| `footsteps/data.js` | the curriculum — `LESSONS[]` (chapters + quizzes) |
| `footsteps/app.js` | rendering, navigation, quiz scoring, widgets, hash deep-linking |

Add or edit a chapter by appending to `LESSONS` in `footsteps/data.js` — no other changes needed.

`svd/index.html` is a single self-contained file (inline CSS + JS, canvas widgets).
