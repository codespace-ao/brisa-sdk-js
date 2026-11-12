import { describe, expect, it } from 'vitest'
import {
  Brisa,
  BrisaAuthenticationError,
  BrisaConnectionError,
  BrisaError,
  BrisaPlanError,
  BrisaRateLimitError,
  BrisaRuleError,
  BrisaTimeoutError,
  BrisaValidationError,
  collect,
  parseRetryAfter,
} from '../src/index.js'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
}

type Reply = Response | Error | ((call: Call) => Response | Promise<Response>)

/** A fetch that answers from a script and records what it was asked. */
function mockFetch(...replies: Reply[]) {
  const calls: Call[] = []
  const fn = (async (input: string | URL | globalThis.Request, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input),
      method: init.method ?? 'GET',
      headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(call)
    const r = replies.shift()
    if (!r) throw new Error(`unexpected call ${call.method} ${call.url}`)
    if (r instanceof Error) throw r
    return typeof r === 'function' ? r(call) : r
  }) as typeof fetch
  return { fn, calls }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
const problem = (status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ type: 'urn:brisa:x', title: 'T', status, detail: 'D', ...extra }), { status, headers: { 'content-type': 'application/problem+json', ...headers } })

const client = (fetch: typeof globalThis.fetch, extra = {}) => new Brisa({ apiKey: 'brk_sbxtest_abc_secret', baseUrl: 'https://api.test/', fetch, maxRetries: 2, ...extra })

describe('autenticação e pedidos', () => {
  it('envia a chave como Bearer e lê JSON', async () => {
    const m = mockFetch(json(200, { subject: 'apikey:abc', grants: {} }, { 'x-ratelimit-limit': '600', 'x-ratelimit-remaining': '599', 'x-ratelimit-reset': '60' }))
    const b = client(m.fn)
    const me = await b.me()
    expect(me.subject).toBe('apikey:abc')
    expect(m.calls[0]?.url).toBe('https://api.test/api/v1/me')
    expect(m.calls[0]?.headers.authorization).toBe('Bearer brk_sbxtest_abc_secret')
    expect(b.rateLimit).toEqual({ limit: 600, remaining: 599, reset: 60 })
  })

  it('falha sem chave', () => {
    const old = process.env.BRISA_API_KEY
    delete process.env.BRISA_API_KEY
    expect(() => new Brisa({ fetch: mockFetch().fn })).toThrow(BrisaError)
    if (old) process.env.BRISA_API_KEY = old
  })

  it('codifica a query e ignora valores vazios', async () => {
    const m = mockFetch(json(200, { items: [], page: 0, size: 10, total: 0 }))
    await client(m.fn).documents.list({ type: 'FT', from: '2026-11-01', size: 10, customerTaxId: undefined })
    const u = new URL(m.calls[0]!.url)
    expect(u.pathname).toBe('/api/v1/documents')
    expect(Object.fromEntries(u.searchParams)).toEqual({ type: 'FT', from: '2026-11-01', size: '10' })
  })

  it('codifica o código do produto no caminho', async () => {
    const m = mockFetch(json(200, { code: 'A/B 1' }))
    await client(m.fn).products.get('A/B 1')
    expect(m.calls[0]?.url).toBe('https://api.test/api/v1/catalog/products/A%2FB%201')
  })
})

describe('idempotência', () => {
  it('gera um Idempotency-Key nas criações e repete-o nas repetições', async () => {
    const m = mockFetch(problem(503, {}, { 'retry-after': '0' }), json(201, { id: 1, number: 'FT FT2026/1' }, { 'idempotent-replayed': 'true' }))
    const doc = await client(m.fn).documents.issue({ type: 'FT', clientId: 1, lines: [{ productCode: 'P1', quantity: 1 }] })
    expect(doc.id).toBe(1)
    const k1 = m.calls[0]?.headers['idempotency-key']
    expect(k1).toMatch(/^brisa-js-[0-9a-f-]{32,36}$/)
    expect(m.calls[1]?.headers['idempotency-key']).toBe(k1)
    expect(m.calls[0]?.body).toEqual({ type: 'FT', clientId: 1, lines: [{ productCode: 'P1', quantity: 1 }] })
  })

  it('usa o Idempotency-Key indicado', async () => {
    const m = mockFetch(json(201, { receipt: { id: 2 } }))
    await client(m.fn).documents.pay(7, { method: 'cash' }, { idempotencyKey: 'pagamento-7-a' })
    expect(m.calls[0]?.headers['idempotency-key']).toBe('pagamento-7-a')
    expect(m.calls[0]?.url).toBe('https://api.test/api/v1/documents/7/payments')
  })

  it('cria clientes e move stock com chave', async () => {
    const m = mockFetch(json(201, { id: 42 }), json(200, { code: 'P', quantity: 3 }))
    const b = client(m.fn)
    expect(await b.clients.create({ name: 'X', taxId: '999999999' })).toEqual({ id: 42 })
    await b.products.moveStock('P', { type: 'in', quantity: 3, reason: 'inicial' })
    expect(m.calls[0]?.headers['idempotency-key']).toBeDefined()
    expect(m.calls[1]?.headers['idempotency-key']).toBeDefined()
  })

  it('expõe replayed na resposta completa', async () => {
    const m = mockFetch(json(201, { id: 1 }, { 'idempotent-replayed': 'true' }))
    const r = await client(m.fn).request<{ id: number }>({ method: 'POST', path: '/api/v1/clients', body: { name: 'x' } }, { idempotencyKey: 'abcdefgh' })
    expect(r.replayed).toBe(true)
    expect(r.status).toBe(201)
  })
})

describe('repetições', () => {
  it('repete 429 respeitando Retry-After', async () => {
    const m = mockFetch(problem(429, { type: 'urn:brisa:rate-limit' }, { 'retry-after': '0' }), json(200, []))
    expect(await client(m.fn).catalog.taxes()).toEqual([])
    expect(m.calls).toHaveLength(2)
  })

  it('desiste depois de maxRetries e lança BrisaRateLimitError', async () => {
    const m = mockFetch(...[0, 1, 2].map(() => problem(429, {}, { 'retry-after': '0' })))
    const e = await client(m.fn)
      .me()
      .catch((x) => x)
    expect(e).toBeInstanceOf(BrisaRateLimitError)
    expect(e.retryAfter).toBe(0)
    expect(e.retryable).toBe(true)
    expect(m.calls).toHaveLength(3)
  })

  it('não espera um Retry-After maior do que maxRetryDelayMs', async () => {
    const m = mockFetch(problem(429, {}, { 'retry-after': '120' }))
    const e = await client(m.fn, { maxRetryDelayMs: 1000 })
      .me()
      .catch((x) => x)
    expect(e).toBeInstanceOf(BrisaRateLimitError)
    expect(e.retryAfter).toBe(120)
    expect(m.calls).toHaveLength(1)
  })

  it('não repete 4xx', async () => {
    const m = mockFetch(problem(422, { type: 'urn:brisa:regra-fiscal', field: 'payment' }))
    const e = await client(m.fn)
      .documents.issue({ type: 'FR', lines: [] })
      .catch((x) => x)
    expect(e).toBeInstanceOf(BrisaRuleError)
    expect(e.field).toBe('payment')
    expect(m.calls).toHaveLength(1)
  })

  it('repete uma falha de rede num GET e num POST com Idempotency-Key', async () => {
    const m = mockFetch(new TypeError('fetch failed'), json(200, { subject: 's', grants: {} }), new TypeError('fetch failed'), json(201, { id: 1 }))
    const b = client(m.fn)
    await b.me()
    await b.clients.create({ name: 'x' })
    expect(m.calls).toHaveLength(4)
  })

  it('não repete uma falha de rede num POST sem Idempotency-Key', async () => {
    const m = mockFetch(new TypeError('fetch failed'))
    const e = await client(m.fn)
      .documents.cancel(1, { reason: 'x', basis: 'not_sent_to_acquirer' })
      .catch((x) => x)
    expect(e).toBeInstanceOf(BrisaConnectionError)
    expect(m.calls).toHaveLength(1)
  })

  it('lança BrisaTimeoutError quando a API não responde', async () => {
    const fetchThatHonoursAbort = (async (input: string | URL | globalThis.Request, init: RequestInit = {}) =>
      new Promise<Response>((_, reject) => {
        void input
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })) as typeof fetch
    const e = await client(fetchThatHonoursAbort, { timeoutMs: 20, maxRetries: 0 })
      .me()
      .catch((x) => x)
    expect(e).toBeInstanceOf(BrisaTimeoutError)
  })
})

describe('erros RFC 9457', () => {
  it('mapeia o estado para a classe', async () => {
    const m = mockFetch(
      problem(400, { type: 'urn:brisa:validacao', errors: { lines: 'não deve estar vazio' } }),
      problem(401, { type: 'urn:brisa:api-key' }),
      problem(402, { type: 'urn:brisa:limite-do-plano', metric: 'invoices', limit: 100 }),
    )
    const b = client(m.fn)
    const e400 = await b.me().catch((x) => x)
    expect(e400).toBeInstanceOf(BrisaValidationError)
    expect(e400.errors).toEqual({ lines: 'não deve estar vazio' })
    expect(await b.me().catch((x) => x)).toBeInstanceOf(BrisaAuthenticationError)
    const e402 = await b.me().catch((x) => x)
    expect(e402).toBeInstanceOf(BrisaPlanError)
    expect(e402.metric).toBe('invoices')
    expect(e402.limit).toBe(100)
    expect(e402.problem.type).toBe('urn:brisa:limite-do-plano')
  })

  it('aguenta um erro que não é JSON (proxy)', async () => {
    const m = mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }), new Response('x', { status: 502 }), new Response('y', { status: 502 }))
    const e = await client(m.fn, { maxRetries: 2 })
      .me()
      .catch((x) => x)
    expect(e.status).toBe(502)
    expect(e.type).toBe('about:blank')
  })
})

describe('respostas', () => {
  it('204 devolve undefined', async () => {
    const m = mockFetch(new Response(null, { status: 204 }))
    expect(await client(m.fn).clients.setActive(3, false)).toBeUndefined()
    expect(m.calls[0]?.body).toEqual({ active: false })
    expect(m.calls[0]?.method).toBe('PUT')
  })

  it('PDF em bytes', async () => {
    const m = mockFetch(new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { 'content-type': 'application/pdf' } }))
    const pdf = await client(m.fn).documents.pdf(1, { format: 'a4' })
    expect(pdf).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(pdf)).toBe('%PDF')
    expect(m.calls[0]?.headers.accept).toBe('application/pdf')
  })

  it('exportação em XML como texto', async () => {
    const m = mockFetch(new Response('<?xml version="1.0"?><x/>', { status: 200, headers: { 'content-type': 'application/xml' } }))
    expect(await client(m.fn).documents.export(1, 'xml')).toContain('<?xml')
    expect(m.calls[0]?.url).toContain('format=xml')
  })
})

describe('paginação', () => {
  it('percorre todas as páginas', async () => {
    const m = mockFetch(
      json(200, { items: [{ id: 1 }, { id: 2 }], page: 0, size: 2, total: 5 }),
      json(200, { items: [{ id: 3 }, { id: 4 }], page: 1, size: 2, total: 5 }),
      json(200, { items: [{ id: 5 }], page: 2, size: 2, total: 5 }),
    )
    const all = await collect(client(m.fn).clients.listAll({ size: 2 }))
    expect(all.map((c) => c.id)).toEqual([1, 2, 3, 4, 5])
    expect(m.calls.map((c) => new URL(c.url).searchParams.get('page'))).toEqual(['0', '1', '2'])
  })

  it('para numa página vazia', async () => {
    const m = mockFetch(json(200, { items: [], page: 0, size: 100, total: 0 }))
    expect(await collect(client(m.fn).documents.listAll())).toEqual([])
  })
})

describe('SAF-T', () => {
  it('espera até ficar pronto', async () => {
    const m = mockFetch(json(200, { id: 1, status: 'REQUESTED' }), json(200, { id: 1, status: 'RUNNING' }), json(200, { id: 1, status: 'READY', sha256: 'x' }))
    const e = await client(m.fn).saft.waitUntilReady(1, { intervalMs: 1 })
    expect(e.status).toBe('READY')
  })

  it('falha com FAILED', async () => {
    const m = mockFetch(json(200, { id: 1, status: 'FAILED', error: 'cadeia partida' }))
    await expect(client(m.fn).saft.waitUntilReady(1, { intervalMs: 1 })).rejects.toThrow(/cadeia partida/)
  })
})

describe('Retry-After', () => {
  it('lê segundos e datas HTTP', () => {
    expect(parseRetryAfter('5')).toBe(5)
    expect(parseRetryAfter(null)).toBeUndefined()
    const now = Date.parse('2026-11-12T10:00:00Z')
    expect(parseRetryAfter('Thu, 12 Nov 2026 10:00:30 GMT', now)).toBe(30)
  })
})
