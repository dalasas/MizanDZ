import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resourceDir = path.join(root, "src-tauri", "resources");
fs.mkdirSync(resourceDir, { recursive: true });

const copy = (from, to) => {
  if (!fs.existsSync(from)) throw new Error(`Missing build resource: ${from}`);
  fs.copyFileSync(from, to);
};

copy(path.join(root, "dist", "server.cjs"), path.join(resourceDir, "server.cjs"));
copy(path.join(root, "node_modules", "sql.js", "dist", "sql-wasm.wasm"), path.join(resourceDir, "sql-wasm.wasm"));

// node.exe is downloaded by the Windows CI workflow. Local Windows builds can place it here manually.
const nodeExe = path.join(resourceDir, "node.exe");
if (!fs.existsSync(nodeExe)) {
  console.warn("[Mizan DZ] src-tauri/resources/node.exe is missing. Windows CI will download it automatically.");
}

console.log("[Mizan DZ] Tauri resources prepared.");
