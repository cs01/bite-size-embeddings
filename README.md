# How LLMs came to be — an interactive history

A documentary in chapters: each one opens on the problem the world was stuck on, walks through how people reasoned out of it, and ends with what they carried forward. Plus standalone deep-dive pages. No build step, no dependencies — static HTML/CSS/JS.

**▶ Live: https://chadsmith.dev/how-llms-came-to-be/** (mirror: https://cs01.github.io/bite-size-embeddings/)

## Pages

| repo path | live URL (chadsmith.dev) | what it is |
|------|--------|-----------|
| `/how-llms-came-to-be/` | `/how-llms-came-to-be/` | the main story — Firth → embeddings → self-attention → RLHF. 15 chapters, each: problem, idea, what was carried forward; live widgets, quizzes, further reading. Saves progress in `localStorage`. Deep-link a chapter with `#<n>`. |
| `/svd/` | `/svd/` | **SVD Explorer** — singular value decomposition built bottom-up: vectors → eigenvectors → geometry → image compression. The math behind the LSA chapter. |
| `/lecture-atlas/` | `/lecture-atlas/` | **Lecture Atlas** — Stanford CS336 (18 lectures) distilled into searchable cards, each linked to the YouTube lecture. Built from `/transcripts/`. |
| `/` | — | landing page for the GitHub Pages mirror only |
| `/transcripts/` | — | cleaned Stanford CS336 lecture transcripts, used to sanity-check coverage and source the Atlas. Not part of the site. |

Cross-links: the LSA chapter → "go deeper" → SVD Explorer, and SVD Explorer → back to the story.

## Run locally

```sh
python3 -m http.server   # then open http://localhost:8000
```

## Course internals

| file | role |
|------|------|
| `how-llms-came-to-be/index.html` | shell + script tags |
| `how-llms-came-to-be/styles.css` | styling (dark theme, responsive) |
| `how-llms-came-to-be/data.js` | the curriculum — `LESSONS[]` (chapters + quizzes) |
| `how-llms-came-to-be/app.js` | rendering, navigation, quiz scoring, widgets, hash deep-linking |

Add or edit a chapter by appending to `LESSONS` in `how-llms-came-to-be/data.js` — no other changes needed.

`svd/index.html` is a single self-contained file (inline CSS + JS, canvas widgets).
