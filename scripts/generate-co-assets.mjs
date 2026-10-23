import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

// Generate actual vectors from the same artwork used by CoCharacter.
const source = new URL('../components/design-system/co-artwork.tsx', import.meta.url)
const { outputText } = ts.transpileModule(readFileSync(source, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const exports = {}
runInNewContext(outputText, { exports, require: createRequire(import.meta.url) }, { filename: fileURLToPath(source) })
for (const variant of exports.coVariants) {
  const svg = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 200 200', role: 'img', 'aria-labelledby': 'co-title' },
    createElement('title', { id: 'co-title' }, `Co ${variant}, your learning companion`),
    createElement(exports.CoArtwork, { variant }),
  )) + '\n'
  writeFileSync(new URL(`../public/co/co-${variant}.svg`, import.meta.url), svg)
  if (variant === 'buddy') {
    writeFileSync(new URL('../public/co.svg', import.meta.url), svg)
    writeFileSync(new URL('../public/co/co-agent.svg', import.meta.url), svg)
  }
}
