import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// Dev only: run the Vercel functions for /api/auth/* and /api/sb/* inside the
// Vite dev server, so cookie mode (VITE_AUTH_MODE=cookie) works with
// `npm run dev`. In production Vercel runs api/*.js itself.
function devApi(env) {
  return {
    name: 'ul-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        const route = url.startsWith('/api/auth/') ? '/api/auth.js' : url.startsWith('/api/sb/') ? '/api/sb.js' : null
        if (!route) return next()
        try {
          const mod = await server.ssrLoadModule(route)
          const handler = route === '/api/auth.js' ? mod.handleAuth : mod.handleProxy
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = chunks.length && !['GET', 'HEAD'].includes(req.method) ? Buffer.concat(chunks) : undefined
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v))
          const request = new Request(`http://${req.headers.host}${url}`, { method: req.method, headers, body })
          const response = await handler(request, { env })
          res.statusCode = response.status
          response.headers.forEach((value, key) => { if (key !== 'set-cookie') res.setHeader(key, value) })
          const cookies = response.headers.getSetCookie?.() || []
          if (cookies.length) res.setHeader('Set-Cookie', cookies)
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(`[ul-dev-api] ${error.message}`)
          res.statusCode = 500
          res.end(JSON.stringify({ error: { message: 'Dev API error' } }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), devApi(env)],
  }
})
