import { describe, expect, it } from 'vitest'
import { MASK, Redactor, redact } from '../src/redact.ts'

/**
 * GitHub push protection matches these vendor shapes byte-for-byte, so every
 * fixture is assembled at runtime. The redactor still sees a real-shaped secret;
 * the scanner never sees one in a source file.
 */
const vendor = (prefix: string, body: string): string => prefix + body
const GITHUB_KEY = vendor('ghp_', 'abcdefghijklmnopqrstuvwxyz01234567')
const GITHUB_FINE = vendor('github_pat_', 'abcdefghijklmnopqrstuvwxyz0123456789')
const RELAY_KEY = vendor('sk_', 'abcdefghijklmnopqrstuvwx')
const STRIPE_KEY = vendor('sk_live_', 'abcdefghijklmnopqrstuvwx')
const AWS_KEY = vendor('AKIA', 'ABCDEFGHIJKLMNOP')
const GOOGLE_KEY = vendor('AIzaSy', 'abcdefghijklmnopqrstuvwxyz0123456')
const SLACK_KEY = vendor('xoxb-', '1234567890123-abcdefghijklmnopqrstuvwx')
const NPM_TOKEN = vendor('npm_', 'abcdefghijklmnopqrstuvwxyz0123456789')

/** Assert a value survived or vanished, and say which. */
function hides(input: string, secret: string, kind: string): void {
  const outcome = redact(input)
  expect(outcome.text, kind).not.toContain(secret)
  expect(outcome.text, kind).toContain(MASK)
  expect(outcome.kinds, kind).toContain(kind)
}

describe('redact masks credential families', () => {
  it('rewrites vendor token shapes', () => {
    hides(`token ${GITHUB_KEY}`, GITHUB_KEY, 'github-token')
    hides(GITHUB_FINE, GITHUB_FINE, 'github-token')
    hides(`key ${RELAY_KEY}`, RELAY_KEY, 'provider-key')
    hides(`stripe ${STRIPE_KEY}`, STRIPE_KEY, 'provider-key')
    hides(`aws ${AWS_KEY}`, AWS_KEY, 'aws-key')
    hides(`google ${GOOGLE_KEY}`, GOOGLE_KEY, 'google-key')
    hides(`slack ${SLACK_KEY}`, SLACK_KEY, 'slack-token')
    hides(`npm ${NPM_TOKEN}`, NPM_TOKEN, 'npm-token')
  })

  it('rewrites bearer headers but keeps the scheme readable', () => {
    const outcome = redact('Authorization: Bearer eyJhbGciOi.abcdefghijklmnopqrstuvwxyz')
    expect(outcome.text).toContain('Bearer ')
    expect(outcome.text).toContain(MASK)
    expect(outcome.text).not.toContain('eyJhbGciOi.abcd')
  })

  it('rewrites a signed JWT', () => {
    hides('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', 'jwt')
  })

  it('rewrites an embedded URL password and keeps the host', () => {
    const outcome = redact('curl https://admin:Sup3rS3cretPasswd@internal.example.com/api')
    expect(outcome.text).not.toContain('Sup3rS3cretPasswd')
    expect(outcome.text).toContain('internal.example.com')
    expect(outcome.kinds).toContain('url-credentials')
  })

  it('rewrites a whole private key block', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----'
    const outcome = redact(pem)
    expect(outcome.text).not.toContain('MIIEowIBAAKCAQEA')
    expect(outcome.kinds).toContain('private-key')
  })

  it('rewrites an assignment but keeps the key name visible', () => {
    const outcome = redact('api_key = "xk-9f8a7b6c5d4e3f2a1b0c"')
    expect(outcome.text).toContain('api_key')
    expect(outcome.text).not.toContain('9f8a7b6c5d4e3f2a1b0c')
    expect(outcome.kinds).toContain('credential-assignment')
  })

  it('masks a vendor token that a word character sits in front of', () => {
    hides(`base64${RELAY_KEY}`, RELAY_KEY, 'provider-key')
    hides(`id=${GITHUB_KEY}`, GITHUB_KEY, 'github-token')
    hides(`x${AWS_KEY}`, AWS_KEY, 'aws-key')
  })

  it('rewrites an email address', () => {
    const outcome = redact('联系 ricardo.example@mail-server.com')
    expect(outcome.text).not.toContain('mail-server.com')
    expect(outcome.kinds).toContain('email')
  })
})

describe('redact leaves code alone', () => {
  it('does not eat environment references', () => {
    for (const input of [
      'apiKey: process.env.DEEPSEEK_API_KEY_2026',
      'token = ${SESSION_TOKEN_VALUE}',
      'secret = %MY_SECRET_VALUE%',
      'password: config.credentials.masterPassword',
      'API_KEY: "A1B2C3D4E5F6A7B8"',
      'client_id = credentials.clientId',
      'secret = true',
    ]) expect(redact(input).text, input).toBe(input)
  })

  it('is a no-op on prose and short values', () => {
    for (const input of ['把配置写入 config.ts', 'password: short', 'the token was refreshed', 'token: 12345678']) {
      expect(redact(input).text, input).toBe(input)
    }
  })

  it('counts one hit per span and reports each family once', () => {
    const outcome = redact(`sk_abcdefghijklmnopqrstuvwx 和 sk_zyxwvutsrqponmlkjihgfe 以及 ghp_abcdefghijklmnopqrstuvwxyz01234567`)
    expect(outcome.hits).toBe(3)
    expect(outcome.kinds.filter((kind) => kind === 'github-token')).toHaveLength(1)
  })

  it('leaves an already masked string untouched', () => {
    const once = redact(`key sk_abcdefghijklmnopqrstuvwx`).text
    const twice = redact(once)
    expect(twice.text).toBe(once)
    expect(twice.hits).toBe(0)
  })

  it('never shares a lastIndex between calls', () => {
    const line = `sk_abcdefghijklmnopqrstuvwx`
    let rounds = 0
    while (rounds < 3) {
      const outcome = redact(`${line} ${line}`)
      expect(outcome.hits).toBe(2)
      rounds += 1
    }
  })
})

describe('Redactor clips and accounts', () => {
  it('passes undefined through', () => {
    expect(new Redactor(true).clip(undefined, 100)).toBeUndefined()
  })

  it('honours the budget with the ellipsis inside it', () => {
    const redactor = new Redactor(true)
    const clipped = redactor.clip('あ'.repeat(50), 20)
    expect(clipped).toHaveLength(20)
    expect(clipped?.endsWith('…')).toBe(true)
  })

  it('redacts a value that fits the budget', () => {
    expect(new Redactor(true).clip(`sk_${'A'.repeat(20)}`, 300)).toBe(MASK)
  })

  it('masks a secret that truncation cut in half', () => {
    const clipped = new Redactor(true).clip(`${'x'.repeat(10)}sk_${'A'.repeat(20)}`, 31) as string
    expect(clipped.length).toBeLessThanOrEqual(31)
    expect(clipped).toContain(MASK)
    expect(clipped).not.toContain('AAAA')
  })

  it('accumulates one report across the fold', () => {
    const redactor = new Redactor(true)
    redactor.clip(`ghp_abcdefghijklmnopqrstuvwxyz01234567`, 300)
    redactor.clip(`sk_abcdefghijklmnopqrstuvwx`, 300)
    const summary = redactor.summary()
    expect(summary.count).toBe(2)
    expect(summary.kinds).toEqual(['github-token', 'provider-key'])
    expect(summary.enabled).toBe(true)
  })

  it('stays silent and untouched when disabled', () => {
    const redactor = new Redactor(false)
    const value = `sk_abcdefghijklmnopqrstuvwx ${'z'.repeat(100)}`
    expect(redactor.clip(value, 300)).toBe(value)
    expect(redactor.clip(value, 20)).toBe('sk_abcdefghijklmnop…')
    expect(redactor.summary()).toEqual({ count: 0, kinds: [], enabled: false })
  })
})
