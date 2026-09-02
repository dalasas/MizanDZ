import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resourceDir = path.join(root, "src-tauri", "resources");
fs.mkdirSync(resourceDir, { recursive: true });

const copy = (from, to) => {
  if (!fs.existsSync(from)) throw new Error(`Missing build resource: ${from}`);
  fs.copyFileSync(from, to);
};

// copy server.cjs
const serverSrc = path.join(root, 'dist', 'server.cjs');
const serverDest = path.join(resourceDir, 'server.cjs');
copy(serverSrc, serverDest);

// copy sql-wasm.wasm
const sqlWasmSrc = path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const sqlWasmDest = path.join(resourceDir, 'sql-wasm.wasm');
copy(sqlWasmSrc, sqlWasmDest);

// copy dist directory (frontend assets) into resources/dist
const distSrc = path.join(root, 'dist');
const distDest = path.join(resourceDir, 'dist');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) throw new Error(`Missing dist directory: ${src}`);
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(distSrc, distDest);

// node.exe is downloaded by the Windows CI workflow. Local Windows builds can place it here manually.
const nodeExe = path.join(resourceDir, "node.exe");
if (!fs.existsSync(nodeExe)) {
  console.warn("[Mizan DZ] src-tauri/resources/node.exe is missing. Windows CI will download it automatically.");
}

console.log("[Mizan DZ] Tauri resources prepared.");
