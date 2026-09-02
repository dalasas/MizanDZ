import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

async function bundle() {
  const entry = path.join(process.cwd(), 'server.ts');
  const outfile = path.join(process.cwd(), 'dist', 'server.cjs');

  // Ensure dist dir
  fs.mkdirSync(path.dirname(outfile), { recursive: true });

  try {
    await build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile,
      sourcemap: true,
      external: [],
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });
  } catch (e) {
    console.error('esbuild bundling failed:', e);
    process.exit(2);
  }

  // Post-bundle checks: ensure no runtime reference to 'vite'
  const code = fs.readFileSync(outfile, 'utf8');
  const lower = code.toLowerCase();
  if (lower.includes("from 'vite'") || lower.includes('from \"vite\"') || lower.includes("require('vite')") || lower.includes('require("vite")') || lower.includes('vite')) {
    // If 'vite' appears but only in comments or other benign areas, that still might indicate a problem.
    // We attempt a stricter check: look for import/require of vite patterns
    const importPattern = /import\s+.*vite|from\s+['\"]vite['\"]/i;
    const requirePattern = /require\(\s*['\"]vite['\"]\s*\)/i;
    if (importPattern.test(code) || requirePattern.test(code)) {
      console.error('ERROR: bundled server.cjs still contains a runtime import/require of "vite". Aborting build.');
      process.exit(3);
    }
  }

  console.log('Bundled server to', outfile);

  // Report bundle size
  const stats = fs.statSync(outfile);
  console.log('server.cjs size:', stats.size, 'bytes');
}

bundle().catch((e) => {
  console.error('build-server failed:', e);
  process.exit(10);
});
