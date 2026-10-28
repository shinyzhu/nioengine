import { rmSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";
const out = join(root, "public");

const required = [
  "p1/dist/index.html",
  "p1/dist/engine-worklet.js",
  "dist/index.html",
  "dist/worklet.js",
  "p2-probe/dist/index.html",
  "p2-bridge/dist/index.html"
];

for (const file of required) {
  if (!existsSync(join(root, file))) {
    throw new Error(`Missing build output: ${file}. Run npm run build:all.`);
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "p0"), { recursive: true });
mkdirSync(join(out, "sensors"), { recursive: true });
mkdirSync(join(out, "bridge"), { recursive: true });

// P1 at the root.
copyFileSync(join(root, "p1/dist/index.html"), join(out, "index.html"));
copyFileSync(join(root, "p1/dist/engine-worklet.js"), join(out, "engine-worklet.js"));

// P0 stays available at /p0/ for capability diagnostics.
copyFileSync(join(root, "dist/index.html"), join(out, "p0/index.html"));
copyFileSync(join(root, "dist/worklet.js"), join(out, "p0/worklet.js"));

// P2.0 sensor capability probe.
copyFileSync(join(root, "p2-probe/dist/index.html"), join(out, "sensors/index.html"));

// P2.2 JS Bridge / vehicle-data probe.
copyFileSync(join(root, "p2-bridge/dist/index.html"), join(out, "bridge/index.html"));

writeFileSync(
  join(out, "404.html"),
  `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 · Engine Sound Lab</title>
<style>
  html,body{height:100%;margin:0;background:#05080c;color:#e9f0f7;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
  main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px}
  h1{margin:0;font-size:clamp(3rem,10vw,7rem);letter-spacing:-.06em;color:#ff5a1f}
  p{margin:10px 0 22px;color:#8fa2b6}
  a{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:0 24px;border-radius:14px;background:#ff5a1f;color:#170900;text-decoration:none;font-weight:800}
</style>
</head>
<body>
<main>
  <h1>404</h1>
  <p>这个页面不存在 / This page does not exist.</p>
  <a href="/">返回声浪 / Back to Engine Sound Lab</a>
</main>
</body>
</html>
`
);

console.log("Assembled Cloudflare assets in public/");
console.log("  /              -> P1");
console.log("  /p0/           -> P0 diagnostics");
console.log("  /sensors/      -> P2.0 sensor probe");
console.log("  /bridge/       -> P2.2 JS Bridge probe");
console.log("  /engine-worklet.js, /p0/worklet.js");
