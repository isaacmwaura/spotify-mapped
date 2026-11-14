import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// npm run build         -> dist/        three files, for ordinary web hosting
// npm run build:single  -> dist-single/ one self-contained index.html
//
// The mode is passed as a flag rather than an environment variable, so the
// same command works in PowerShell, Command Prompt, macOS and Linux.
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    base: './',
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsDir: 'assets',
    },
  }
})
