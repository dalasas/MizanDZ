import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resourceDir = path.join(root, "src-tauri", "resources");
const frontendDist = path.join(root, "dist");
const bundledDist = path.join(resourceDir, "dist");

fs.mkdirSync(resourceDir, { recursive: true });

const copy = (from, to) => {
  if (!fs.existsSync(from)) {
    throw new Error(`Missing build resource: ${from}`);
  }

  fs.copyFileSync(from, to);
};

if (!fs.existsSync(frontendDist)) {
  throw new Error(`Missing frontend build directory: ${frontendDist}`);
}

if (!fs.existsSync(path.join(frontendDist, "index.html"))) {
  throw new Error(
    `Missing frontend entry point: ${path.join(frontendDist, "index.html")}`
  );
}

copy(
  path.join(frontendDist, "server.cjs"),
  path.join(resourceDir, "server.cjs")
);

copy(
  path.join(root, "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
  path.join(resourceDir, "sql-wasm.wasm")
);

// The desktop backend serves the React frontend from resources/dist.
fs.rmSync(bundledDist, { recursive: true, force: true });
fs.cpSync(frontendDist, bundledDist, { recursive: true });

const nodeExe = path.join(resourceDir, "node.exe");

if (!fs.existsSync(nodeExe)) {
  console.warn(
    "[Mizan DZ] src-tauri/resources/node.exe is missing. " +
      "The Windows CI workflow will download it before the Tauri build."
  );
}

console.log("[Mizan DZ] Tauri resources prepared successfully.");
