# Footsteps — How We Taught Machines Meaning

An interactive walk through the ideas that taught machines meaning — from
Firth's 1957 *"you shall know a word by the company it keeps"* to embeddings,
self-attention, and RLHF. One continuous thread, 13 chapters, refined for 65 years.

**▶ Live: https://cs01.github.io/bite-size-embeddings/**

Click through the timeline, play with the live widgets (cosine similarity,
self-attention weights, autoregressive generation), and quiz yourself as you go.
Progress is saved locally in your browser.

## Run locally

No build step, no dependencies. Open `index.html`, or serve the folder:

```sh
python3 -m http.server   # then open http://localhost:8000
```

## Files

| file         | what it is                                        |
|--------------|---------------------------------------------------|
| `index.html` | shell + script tags                               |
| `styles.css` | all styling (dark theme, responsive)              |
| `data.js`    | the curriculum — `LESSONS[]` (chapters + quizzes) |
| `app.js`     | rendering, navigation, quiz scoring, widgets      |

Add or edit a chapter by appending to `LESSONS` in `data.js` — no other changes needed.
