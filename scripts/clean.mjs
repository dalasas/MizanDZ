import fs from "node:fs";
import path from "node:path";
for (const p of ["dist", "src-tauri/resources/server.cjs", "src-tauri/resources/sql-wasm.wasm"]) {
  const full = path.resolve(p);
  if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
}
