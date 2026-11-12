import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { BrisaWebhookSignatureError, parseSignatureHeader, signWebhookPayload, verifyWebhook } from '../src/index.js'

const secret = 'whsec_test_secret'
const body = '{"id":"evt_1","type":"document.issued","createdAt":"2026-11-12T10:17:54Z","tenant":"sbxdemo","data":{"documentId":1,"documentNo":"FT FT2026/1"}}'
const t = 1794478676
const sig = (s: string, ts = t, b = body) => createHmac('sha256', s).update(`${ts}.${b}`).digest('hex')

describe('verifyWebhook', () => {
  it('aceita uma assinatura válida e devolve o evento', async () => {
    const event = await verifyWebhook(body, `t=${t},v1=${sig(secret)}`, secret, { now: t + 10 })
    expect(event.type).toBe('document.issued')
    expect(event.data.documentId).toBe(1)
  })

  it('aceita bytes', async () => {
    const event = await verifyWebhook(new TextEncoder().encode(body), `t=${t},v1=${sig(secret)}`, secret, { now: t })
    expect(event.id).toBe('evt_1')
  })

  it('aceita quando um dos dois v1 coincide (troca do segredo)', async () => {
    const header = `t=${t},v1=${sig('whsec_novo')},v1=${sig(secret)}`
    await expect(verifyWebhook(body, header, secret, { now: t })).resolves.toBeTruthy()
  })

  it('aceita uma lista de segredos', async () => {
    await expect(verifyWebhook(body, `t=${t},v1=${sig(secret)}`, ['whsec_outro', secret], { now: t })).resolves.toBeTruthy()
  })

  it('recusa outro segredo, um corpo alterado, cabeçalhos em falta ou mal formados', async () => {
    await expect(verifyWebhook(body, `t=${t},v1=${sig('outro')}`, secret, { now: t })).rejects.toBeInstanceOf(BrisaWebhookSignatureError)
    await expect(verifyWebhook(body.replace('FT2026/1', 'FT2026/2'), `t=${t},v1=${sig(secret)}`, secret, { now: t })).rejects.toBeInstanceOf(BrisaWebhookSignatureError)
    await expect(verifyWebhook(body, undefined, secret)).rejects.toBeInstanceOf(BrisaWebhookSignatureError)
    await expect(verifyWebhook(body, 'v1=abc', secret)).rejects.toBeInstanceOf(BrisaWebhookSignatureError)
  })

  it('recusa um t fora da tolerância', async () => {
    await expect(verifyWebhook(body, `t=${t},v1=${sig(secret)}`, secret, { now: t + 301 })).rejects.toThrow(/relógio/)
    await expect(verifyWebhook(body, `t=${t},v1=${sig(secret)}`, secret, { now: t + 301, toleranceSeconds: 0 })).resolves.toBeTruthy()
  })

  it('signWebhookPayload produz um cabeçalho que verifyWebhook aceita', async () => {
    const header = await signWebhookPayload(body, secret, t)
    expect(header).toBe(`t=${t},v1=${sig(secret)}`)
    await expect(verifyWebhook(body, header, secret, { now: t })).resolves.toBeTruthy()
  })

  it('parseSignatureHeader', () => {
    expect(parseSignatureHeader('t=1, v1=AB ,v1=cd,x=1')).toEqual({ timestamp: 1, signatures: ['ab', 'cd'] })
  })
})
