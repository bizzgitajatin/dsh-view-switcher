import { writeFileSync } from 'node:fs'

const targets = [
  ['https://unpkg.com/react@18.3.1/umd/react.production.min.js', 'demo/vendor/react.production.min.js'],
  ['https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js', 'demo/vendor/react-dom.production.min.js'],
]

for (const [url, path] of targets) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    console.log(`FAIL ${response.status} ${url}`)
    continue
  }
  const text = await response.text()
  writeFileSync(path, text, 'utf8')
  console.log(`OK ${path} ${text.length} bytes`)
}
