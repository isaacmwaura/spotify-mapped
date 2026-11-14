import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`        -> dist/ as three files (normal web hosting)
// `SINGLE=1 npm run build` -> dist/index.html as ONE self-contained file
const single = !!process.env.SINGLE

export default defineConfig({
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  base: './',
  build: {
    outDir: single ? 'dist-single' : 'dist',
    assetsDir: 'assets',
  },
})
