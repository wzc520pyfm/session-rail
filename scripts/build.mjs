import { mkdirSync, writeFileSync } from 'node:fs'
import * as esbuild from 'esbuild'

mkdirSync('lib', { recursive: true })

await esbuild.build({
  entryPoints: ['src/host/plugin.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: false,
})

const client = await esbuild.build({
  entryPoints: ['src/client/entry.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'transform',
  external: ['react', 'react-dom'],
  write: false,
})

const code = client.outputFiles[0]?.text ?? ''
writeFileSync('lib/client.js', `window.__ModuleLoader__.load({
  id: "session-rail",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    ${code}
    return module.exports;
  }
});
`)
