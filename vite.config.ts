import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: { target: 'es2024' },
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
