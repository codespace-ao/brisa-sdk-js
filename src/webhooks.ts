import { BrisaWebhookSignatureError } from './errors.js'
import type { WebhookEvent } from './types.js'

export interface VerifyWebhookOptions {
  /** Diferença máxima, em segundos, entre o `t` da assinatura e o relógio local (por omissão 300). */
  toleranceSeconds?: number
  /** O instante atual em segundos (para testes). */
  now?: number
}

const encoder = new TextEncoder()

type Hmac = (secret: string, message: string) => Promise<string>

let hmacImpl: Hmac | undefined

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  if (!hmacImpl) {
    const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle
    if (subtle) {
      hmacImpl = async (s, m) => {
        const key = await subtle.importKey('raw', encoder.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        return toHex(new Uint8Array(await subtle.sign('HMAC', key, encoder.encode(m))))
      }
    } else {
      // Node.js 18 without the global Web Crypto: the module, loaded only here so bundlers for the browser leave it out
      const name = 'node:crypto'
      const nodeCrypto = (await import(/* @vite-ignore */ /* webpackIgnore: true */ name)) as typeof import('node:crypto')
      hmacImpl = async (s, m) => nodeCrypto.createHmac('sha256', s).update(m).digest('hex')
    }
  }
  return hmacImpl(secret, message)
}

function toHex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** `t=<segundos>,v1=<hex>[,v1=<hex>]` → `{ timestamp, signatures }`. */
export function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } {
  let timestamp = Number.NaN
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (k === 't') timestamp = Number(v)
    else if (k === 'v1' && /^[0-9a-f]+$/i.test(v)) signatures.push(v.toLowerCase())
  }
  return { timestamp, signatures }
}

function text(payload: string | Uint8Array | ArrayBuffer): string {
  if (typeof payload === 'string') return payload
  return new TextDecoder().decode(payload instanceof ArrayBuffer ? new Uint8Array(payload) : payload)
}

/**
 * Verifica a assinatura de um webhook (`Brisa-Signature`) e devolve o evento.
 *
 * Use o corpo **bruto**, tal como chegou (antes de o interpretar como JSON). Durante a troca do segredo vêm dois `v1`: basta um coincidir.
 * Lança `BrisaWebhookSignatureError` se a assinatura não coincidir ou se `t` estiver fora da tolerância.
 *
 * ```ts
 * app.post('/webhooks/brisa', express.raw({ type: 'application/json' }), async (req, res) => {
 *   const event = await verifyWebhook(req.body, req.get('Brisa-Signature'), process.env.BRISA_WEBHOOK_SECRET)
 *   res.sendStatus(200)
 * })
 * ```
 */
export async function verifyWebhook<D = Record<string, unknown>>(
  payload: string | Uint8Array | ArrayBuffer,
  signatureHeader: string | null | undefined,
  secret: string | string[],
  options: VerifyWebhookOptions = {},
): Promise<WebhookEvent<D>> {
  if (!signatureHeader) throw new BrisaWebhookSignatureError('Falta o cabeçalho Brisa-Signature.')
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader)
  if (!Number.isFinite(timestamp) || signatures.length === 0) throw new BrisaWebhookSignatureError('Cabeçalho Brisa-Signature mal formado.')
  const tolerance = options.toleranceSeconds ?? 300
  const now = options.now ?? Math.floor(Date.now() / 1000)
  if (tolerance > 0 && Math.abs(now - timestamp) > tolerance)
    throw new BrisaWebhookSignatureError(`A assinatura tem ${Math.abs(now - timestamp)} s de diferença do relógio (máximo ${tolerance} s).`)
  const body = text(payload)
  for (const s of Array.isArray(secret) ? secret : [secret]) {
    const expected = await hmacSha256Hex(s, `${timestamp}.${body}`)
    if (signatures.some((v) => timingSafeEqual(v, expected))) {
      try {
        return JSON.parse(body) as WebhookEvent<D>
      } catch (e) {
        throw new BrisaWebhookSignatureError('A assinatura é válida mas o corpo não é JSON.', { cause: e })
      }
    }
  }
  throw new BrisaWebhookSignatureError('A assinatura não coincide com o segredo do webhook.')
}

/** Calcula o cabeçalho `Brisa-Signature` de um corpo: útil para testar o seu endpoint. */
export async function signWebhookPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): Promise<string> {
  return `t=${timestamp},v1=${await hmacSha256Hex(secret, `${timestamp}.${payload}`)}`
}
