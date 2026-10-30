import { readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
const version = "0.8.1";
const buildTime = new Date().toISOString();

mkdirSync(dist, { recursive: true });

const html = readFileSync(join(here, "index.html"), "utf8");
const css = readFileSync(join(here, "styles.css"), "utf8");
const i18n = readFileSync(join(here, "i18n.js"), "utf8");
const app = readFileSync(join(here, "app.js"), "utf8");
const worklet = readFileSync(join(here, "engine-worklet.js"), "utf8");

for (const [name, code] of [["styles.css", css], ["i18n.js", i18n], ["app.js", app], ["engine-worklet.js", worklet]]) {
  if (code.includes("</script")) throw new Error(`${name} contains </script and cannot be inlined safely`);
}

const output = html
  .replace("<!-- INLINE_STYLES -->", `<style>\n${css}\n</style>`)
  .replace("/*__WORKLET__*/", worklet)
  .replace("/*__I18N__*/", i18n)
  .replace("/*__APP__*/", app)
  .replace("__VERSION__", version)
  .replace("__BUILD_TIME__", buildTime);

writeFileSync(join(dist, "index.html"), output);
copyFileSync(join(here, "engine-worklet.js"), join(dist, "engine-worklet.js"));

console.log(`Built p1/dist/index.html (${(statSync(join(dist, "index.html")).size / 1024).toFixed(1)} KiB)`);
console.log(`Copied p1/dist/engine-worklet.js (${(statSync(join(dist, "engine-worklet.js")).size / 1024).toFixed(1)} KiB)`);
console.log(`P1 version ${version} · ${buildTime}`);
