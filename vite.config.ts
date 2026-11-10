import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

function preloadStartup(): Plugin {
  return {
    name: 'preload-startup-modules',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle, chunk }) {
        if (!bundle || !chunk) return []
        const loaded = new Set([chunk.fileName, ...chunk.imports])
        const preloads = new Set<string>()
        function include(file: string) {
          if (loaded.has(file) || preloads.has(file)) return
          const dependency = bundle?.[file]
          if (dependency?.type !== 'chunk') return
          preloads.add(file)
          dependency.imports.forEach(include)
        }
        chunk.dynamicImports.forEach(include)
        return [...preloads].map((file) => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', href: `/${file}`, crossorigin: true },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwind(), preloadStartup()],
})
