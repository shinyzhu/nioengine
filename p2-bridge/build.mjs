import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const version = "0.1.0";
const buildTime = new Date().toISOString();

const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "styles.css"), "utf8");
const app = readFileSync(join(root, "app.js"), "utf8");

let out = html.replace("<!-- INLINE_STYLES -->", () => `<style>\n${css}\n</style>`);
out = out.replace("/*__APP__*/", () => app);
out = out.replace("__VERSION__", version);
out = out.replace("__BUILD_TIME__", buildTime);

if (out.includes("/*__APP__*/") || out.includes("__VERSION__") || out.includes("__BUILD_TIME__")) {
  throw new Error("P2.2 build left placeholders in output");
}

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/index.html"), out);
console.log(`Built p2-bridge/dist/index.html (${(out.length / 1024).toFixed(1)} KiB)`);
console.log(`P2.2 bridge probe version ${version} · ${buildTime}`);
