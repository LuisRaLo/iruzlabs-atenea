import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install, isAllowedDomain } from '../src/host/auth.js'

test('isAllowedDomain validates corporate domains strictly', () => {
  assert.equal(isAllowedDomain('luis@iruzlabs.com'), true)
  assert.equal(isAllowedDomain('admin@azurylabs.online'), true)
  assert.equal(isAllowedDomain('engineer@sub.iruzlabs.com'), true)
  assert.equal(isAllowedDomain('LUIS@IRUZLABS.COM'), true)

  assert.equal(isAllowedDomain('user@gmail.com'), false)
  assert.equal(isAllowedDomain('user@outlook.com'), false)
  assert.equal(isAllowedDomain('user@deepseek.com'), false)
  assert.equal(isAllowedDomain('invalid-email'), false)
  assert.equal(isAllowedDomain(''), false)
  assert.equal(isAllowedDomain(null), false)
})

test('auth module manages corporate user session lifecycle', async () => {
  const state = {}
  const rt = {
    state,
    config: {
      authDomains: ['iruzlabs.com', 'azurylabs.online'],
    },
    save: async () => {},
  }

  install(rt)

  // 1. Initial auth view
  const initialView = rt.authView()
  assert.equal(initialView.required, true)
  assert.equal(initialView.user, null)
  assert.deepEqual(initialView.domains, ['iruzlabs.com', 'azurylabs.online'])
  assert.deepEqual(initialView.providers, ['google', 'microsoft'])

  // 2. Reject dev login with unauthorized domain
  await assert.rejects(
    async () => {
      await rt.authEndpoint('auth-dev-login', { email: 'hacker@gmail.com', provider: 'google' })
    },
    /Dominio no permitido/i,
  )

  // 3. Successful dev login with authorized domain
  const loggedView = await rt.authEndpoint('auth-dev-login', {
    email: 'luis@iruzlabs.com',
    name: 'Luis Ramírez',
    provider: 'google',
  })

  assert.equal(loggedView.user.email, 'luis@iruzlabs.com')
  assert.equal(loggedView.user.name, 'Luis Ramírez')
  assert.equal(loggedView.user.provider, 'google')
  assert.equal(state.user.email, 'luis@iruzlabs.com')

  // 4. Successful dev login with azurylabs.online
  const azuryView = await rt.authEndpoint('auth-dev-login', {
    email: 'dev@azurylabs.online',
    name: 'Azury Dev',
    provider: 'microsoft',
  })
  assert.equal(azuryView.user.email, 'dev@azurylabs.online')
  assert.equal(azuryView.user.provider, 'microsoft')

  // 5. Sign out clears the session
  const signedOutView = await rt.authEndpoint('auth-sign-out')
  assert.equal(signedOutView.user, null)
  assert.equal(state.user, null)

  // 6. Auth start without client ID returns configured: false
  const unconfigured = await rt.authEndpoint('auth-start', { provider: 'google' })
  assert.equal(unconfigured.configured, false)
  assert.equal(unconfigured.provider, 'google')
})
