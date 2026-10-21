import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
export default defineConfig({
  root,
  plugins: [react()],
  resolve: { alias: [
    { find: 'next/navigation', replacement: fileURLToPath(new URL('./next-navigation.ts', import.meta.url)) },
    { find: 'next/link', replacement: fileURLToPath(new URL('./next-link.tsx', import.meta.url)) },
    { find: '@', replacement: root },
  ] },
  server: { host: '127.0.0.1', port: 3103, strictPort: true },
})
