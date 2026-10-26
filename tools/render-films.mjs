// Renders every chapter film to MP4. Scenes are pure functions of time, so we
// step the timeline frame by frame in headless Chrome and pipe screenshots to
// ffmpeg: output is exact and stutter-free no matter how slow each frame is.
//
//   node tools/render-films.mjs [--only selfattn] [--fps 60] [--sizes 1920x1080,1080x1080]
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "how-llms-came-to-be");
const OUT = join(ROOT, "films");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg("fps", 60);
const SIZES = arg("sizes", "1920x1080,1080x1080").split(",").map((s) => s.split("x").map(Number));
const ONLY = arg("only", "");

// the film list comes from the curriculum itself: any chapter with a { scene } block
const LESSONS = new Function(readFileSync(join(SITE, "data.js"), "utf8") + "; return LESSONS;")();
const films = LESSONS.flatMap((l, i) => l.body.filter((b) => b.scene).map((b) => ({
  scene: b.scene, title: `${l.year} · ${l.title}`, chapter: i + 1,
}))).filter((f) => !ONLY || ONLY.split(",").includes(f.scene));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  const p = join(SITE, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(SITE) || !existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" }).end(readFileSync(p));
}).listen(0);
const port = server.address().port;

// --use-angle=metal keeps WebGL on the GPU; headless otherwise falls back to SwiftShader
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
mkdirSync(OUT, { recursive: true });

for (const f of films) {
  for (const [w, h] of SIZES) {
    const out = join(OUT, `${String(f.chapter).padStart(2, "0")}-${f.scene}-${w}x${h}.mp4`);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error(`  page error: ${e.message}`));
    await page.goto(`http://localhost:${port}/render.html?scene=${f.scene}&title=${encodeURIComponent(f.title)}`);
    await page.waitForFunction(() => window.__film, null, { timeout: 30000 });
    const duration = await page.evaluate(() => window.__film.duration);
    const frames = Math.ceil(duration * FPS);

    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
      "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
      { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise((r, j) => ff.on("close", (c) => (c ? j(new Error(`ffmpeg exit ${c}`)) : r())));

    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.__film.renderAt(t), i / FPS);
      const buf = await page.screenshot({ type: "jpeg", quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (i % (FPS * 5) === 0) process.stdout.write(`\r  ${f.scene} ${w}x${h}  ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s `);
    }
    ff.stdin.end();
    await done;
    await page.close();
    console.log(`\r  ${out.replace(ROOT + "/", "")}  ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
await browser.close();
server.close();
