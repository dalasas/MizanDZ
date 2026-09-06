import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const outFile = path.join(root, "dist", "server.cjs");

await build({
  entryPoints: [path.join(root, "server.ts")],
  outfile: outFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  sourcemap: true,
  packages: "bundle",
  define: {
    "process.env.NODE_ENV": '"production"'
  }
});

if (!fs.existsSync(outFile)) {
  throw new Error(`[Mizan DZ] Server bundle was not created: ${outFile}`);
}

const code = fs.readFileSync(outFile, "utf8");

if (
  /\brequire\(["']vite["']\)|\bfrom\s+["']vite["']/.test(code)
) {
  throw new Error(
    "[Mizan DZ] Production server bundle still references Vite."
  );
}

console.log(
  `[Mizan DZ] Production server bundle created: ${outFile}`
);
