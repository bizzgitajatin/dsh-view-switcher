// Copies the built client bundle next to the demo page so the page works when
// it is opened directly from `demo/` (the workbench only serves that folder).
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = `${root}dist/client.js`
const target = `${root}demo/client.js`

if (!existsSync(source)) {
  console.error('demo: dist/client.js not found — run `pnpm build` first')
  process.exit(1)
}

copyFileSync(source, target)
console.log('demo: copied dist/client.js -> demo/client.js')
