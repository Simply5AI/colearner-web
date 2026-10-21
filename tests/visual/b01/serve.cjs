// Use Vite already installed as Vitest's dependency; no package install needed.
const { createRequire } = require('node:module')
const { dirname, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const vitestRequire = createRequire(require.resolve('vitest/package.json'))
const vitePackage = vitestRequire.resolve('vite/package.json')
process.argv = [process.execPath, join(dirname(vitePackage), 'bin/vite.js'), '--config', 'tests/visual/b01/vite.config.mts']
import(pathToFileURL(process.argv[1]).href)
