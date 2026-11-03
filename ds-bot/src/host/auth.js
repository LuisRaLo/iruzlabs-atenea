// Auth: corporate single sign-on (Google Workspace & Microsoft 365) for Atenea internal access.
// Only accounts with authorized corporate domains (@iruzlabs.com and @azurylabs.online) may access the app.
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'

export const DEFAULT_DOMAINS = ['iruzlabs.com', 'azurylabs.online']

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MS_USERINFO_URL = 'https://graph.microsoft.com/v1.0/me'

export function isAllowedDomain(email, allowed = DEFAULT_DOMAINS) {
  if (typeof email !== 'string') return false
  const parts = email.trim().toLowerCase().split('@')
  if (parts.length !== 2) return false
  const domain = parts[1]
  return allowed.some(d => domain === d.toLowerCase() || domain.endsWith(`.${d.toLowerCase()}`))
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pkcePair() {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

const SUCCESS_HTML = (email) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Atenea · Autenticación Exitosa</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0b0f19;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;max-width:420px;padding:36px;background:#131b2e;border-radius:16px;border:1px solid #1e293b;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
    <div style="width:48px;height:48px;margin:0 auto 16px;border-radius:50%;background:rgba(56,189,248,0.15);display:flex;align-items:center;justify-content:center;color:#38bdf8;font-size:24px;">✓</div>
    <h2 style="color:#f8fafc;margin:0 0 8px;font-size:20px;">Autenticación Exitosa</h2>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 18px;">Sesión iniciada como <strong style="color:#38bdf8;">${email}</strong>.</p>
    <p style="color:#64748b;font-size:12px;margin:0;">Puedes cerrar esta ventana y volver a <strong>Atenea</strong>.</p>
  </div>
</body>
</html>`

const DENIED_HTML = (email, domains) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Atenea · Acceso Denegado</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0b0f19;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;max-width:420px;padding:36px;background:#131b2e;border-radius:16px;border:1px solid #331515;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
    <div style="width:48px;height:48px;margin:0 auto 16px;border-radius:50%;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;color:#ef4444;font-size:24px;">✕</div>
    <h2 style="color:#ef4444;margin:0 0 8px;font-size:20px;">Acceso Denegado</h2>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 16px;">La cuenta <strong style="color:#fff;">${email}</strong> no pertenece a la organización.</p>
    <p style="color:#cbd5e1;font-size:13px;background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:8px;margin:0 0 16px;">Solo se permiten cuentas de: <br><strong>${domains.map(d => '@' + d).join(' o ')}</strong></p>
    <p style="color:#64748b;font-size:12px;margin:0;">Vuelve a Atenea para iniciar sesión con una cuenta autorizada.</p>
  </div>
</body>
</html>`

export function install(rt) {
  const { state } = rt
  const domains = rt.config.authDomains ?? (process.env.ATENEA_AUTH_DOMAINS ? process.env.ATENEA_AUTH_DOMAINS.split(',').map(s => s.trim()) : DEFAULT_DOMAINS)
  const googleClientId = rt.config.googleClientId ?? process.env.ATENEA_GOOGLE_CLIENT_ID
  const msClientId = rt.config.microsoftClientId ?? process.env.ATENEA_MICROSOFT_CLIENT_ID

  let activeFlow = null

  const authView = () => ({
    required: true,
    user: state.user ?? null,
    domains,
    providers: ['google', 'microsoft'],
    googleConfigured: Boolean(googleClientId),
    microsoftConfigured: Boolean(msClientId),
  })

  const cancelFlow = () => {
    if (activeFlow?.server) {
      try { activeFlow.server.close() } catch {}
    }
    activeFlow = null
  }

  const endpoints = {
    async 'auth-view'() {
      return authView()
    },

    async 'auth-start'(body) {
      const provider = body?.provider === 'microsoft' ? 'microsoft' : 'google'
      cancelFlow()

      const clientId = provider === 'google' ? googleClientId : msClientId
      if (!clientId) {
        // If client id is not yet set in environment, return flag so client can prompt or offer dev sign-in
        return {
          configured: false,
          provider,
          message: `Configure el ${provider === 'google' ? 'Google Client ID (ATENEA_GOOGLE_CLIENT_ID)' : 'Microsoft Client ID (ATENEA_MICROSOFT_CLIENT_ID)'} para el acceso de producción.`,
        }
      }

      const { verifier, challenge } = pkcePair()
      const stateToken = randomBytes(16).toString('hex')

      return new Promise((resolve, reject) => {
        const server = createServer(async (req, res) => {
          try {
            const reqUrl = new URL(req.url, `http://127.0.0.1:${server.address().port}`)
            if (reqUrl.pathname !== '/auth/callback') {
              res.writeHead(404)
              res.end('Not found')
              return
            }

            const returnedState = reqUrl.searchParams.get('state')
            const code = reqUrl.searchParams.get('code')
            const error = reqUrl.searchParams.get('error')

            if (error || !code || returnedState !== stateToken) {
              res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
              res.end('<h1>Error de autenticación</h1><p>No se pudo completar el inicio de sesión.</p>')
              cancelFlow()
              return
            }

            const redirectUri = `http://127.0.0.1:${server.address().port}/auth/callback`
            let profile

            if (provider === 'google') {
              const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  client_id: clientId,
                  code,
                  code_verifier: verifier,
                  grant_type: 'authorization_code',
                  redirect_uri: redirectUri,
                }),
              })
              const tokenData = await tokenRes.json()
              if (!tokenData.access_token) throw new Error(tokenData.error_description || 'No access token received')

              const userRes = await fetch(GOOGLE_USERINFO_URL, {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
              })
              const userData = await userRes.json()
              profile = {
                name: userData.name || userData.email,
                email: userData.email,
                avatar: userData.picture || null,
                provider: 'google',
              }
            } else {
              const tokenRes = await fetch(MS_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  client_id: clientId,
                  code,
                  code_verifier: verifier,
                  grant_type: 'authorization_code',
                  redirect_uri: redirectUri,
                }),
              })
              const tokenData = await tokenRes.json()
              if (!tokenData.access_token) throw new Error(tokenData.error_description || 'No access token received')

              const userRes = await fetch(MS_USERINFO_URL, {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
              })
              const userData = await userRes.json()
              profile = {
                name: userData.displayName || userData.userPrincipalName,
                email: userData.mail || userData.userPrincipalName,
                avatar: null,
                provider: 'microsoft',
              }
            }

            if (!profile?.email || !isAllowedDomain(profile.email, domains)) {
              res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' })
              res.end(DENIED_HTML(profile?.email || 'desconocido', domains))
              cancelFlow()
              return
            }

            state.user = {
              ...profile,
              loggedInAt: Date.now(),
            }
            await rt.save()

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(SUCCESS_HTML(profile.email))
            cancelFlow()
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<h1>Error</h1><p>${err.message}</p>`)
            cancelFlow()
          }
        })

        server.listen(0, '127.0.0.1', () => {
          const port = server.address().port
          const redirectUri = `http://127.0.0.1:${port}/auth/callback`
          let authUrl

          if (provider === 'google') {
            const params = new URLSearchParams({
              client_id: clientId,
              redirect_uri: redirectUri,
              response_type: 'code',
              scope: 'openid email profile',
              state: stateToken,
              code_challenge: challenge,
              code_challenge_method: 'S256',
              hd: domains[0],
              prompt: 'select_account',
            })
            authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`
          } else {
            const params = new URLSearchParams({
              client_id: clientId,
              redirect_uri: redirectUri,
              response_type: 'code',
              scope: 'openid email profile User.Read',
              state: stateToken,
              code_challenge: challenge,
              code_challenge_method: 'S256',
              prompt: 'select_account',
            })
            authUrl = `${MS_AUTH_URL}?${params.toString()}`
          }

          activeFlow = { server, stateToken }
          resolve({ configured: true, authUrl, provider })
        })

        server.on('error', (err) => {
          cancelFlow()
          reject(err)
        })
      })
    },

    async 'auth-cancel'() {
      cancelFlow()
      return { ok: true }
    },

    async 'auth-sign-out'() {
      cancelFlow()
      state.user = null
      await rt.save()
      return authView()
    },

    async 'auth-dev-login'(body) {
      const email = String(body?.email ?? '').trim()
      if (!email) throw new Error('Ingresa un correo corporativo')
      if (!isAllowedDomain(email, domains)) {
        throw new Error(`Dominio no permitido. Solo se permiten cuentas de: ${domains.map(d => '@' + d).join(' o ')}`)
      }
      const provider = body?.provider === 'microsoft' ? 'microsoft' : 'google'
      const name = String(body?.name ?? '').trim() || email.split('@')[0]
      state.user = {
        name,
        email,
        avatar: null,
        provider,
        loggedInAt: Date.now(),
      }
      await rt.save()
      return authView()
    },
  }

  const authEndpoint = (endpoint, body) => endpoints[endpoint](body ?? {})

  Object.assign(rt, {
    authView,
    authEndpoint,
    authDomains: domains,
  })
}
