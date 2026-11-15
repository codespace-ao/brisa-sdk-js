import { describe, expect, it } from 'vitest'
import type { ClientStatement, DocumentDetail, IssueDocumentRequest } from '../src/index.js'
import { Brisa } from '../src/index.js'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
}

/** A fetch that answers from a script and records what it was asked. */
function mockFetch(...replies: Response[]) {
  const calls: Call[] = []
  const fn = (async (input: string | URL | globalThis.Request, init: RequestInit = {}) => {
    calls.push({
      url: String(input),
      method: init.method ?? 'GET',
      headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    })
    const r = replies.shift()
    if (!r) throw new Error('unexpected call')
    return r
  }) as typeof fetch
  return { fn, calls }
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const client = (fetch: typeof globalThis.fetch) => new Brisa({ apiKey: 'brk_sbxtest_abc_secret', baseUrl: 'https://api.test/', fetch, maxRetries: 0 })

const FR: IssueDocumentRequest = {
  type: 'FR',
  customer: { name: 'Consumidor final' } as never,
  lines: [{ description: 'Artigo', quantity: 1, unitPrice: 100 }] as never,
}

describe('papéis: A4, A5 e os rolos de 80 e 58 mm', () => {
  it.each(['a4', 'a5', 'thermal80', 'thermal58', 'thermal'] as const)('pede o PDF em %s', async (format) => {
    const m = mockFetch(new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } }))
    const pdf = await client(m.fn).documents.pdf(7, { format, copy: 'second' })
    expect(new TextDecoder().decode(pdf)).toBe('%PDF-1.7')
    const u = new URL(m.calls[0]!.url)
    expect(u.pathname).toBe('/api/v1/documents/7/pdf')
    expect(Object.fromEntries(u.searchParams)).toEqual({ format, copy: 'second' })
    expect(m.calls[0]!.headers.accept).toBe('application/pdf')
  })
})

describe('venda direta paga com vários meios', () => {
  it('envia a lista de pagamentos tal como está, com um Idempotency-Key', async () => {
    const m = mockFetch(json(201, { id: 9, number: 'FR FR2026/9', sequence: 9, hash: 'h', hashControl: 'abcd', grossTotal: 114 }))
    const payment = {
      payments: [
        { method: 'debit_card' as const, amount: 50 },
        { method: 'cash' as const, amount: 100 },
      ],
    }
    await client(m.fn).documents.issue({ ...FR, payment })
    expect(m.calls[0]!.method).toBe('POST')
    expect((m.calls[0]!.body as { payment: unknown }).payment).toEqual(payment)
    expect(m.calls[0]!.headers['idempotency-key']).toMatch(/^brisa-js-/)
  })

  it('continua a aceitar um só meio, com ou sem valor entregue', async () => {
    const m = mockFetch(json(201, { id: 1 }), json(201, { id: 2 }))
    const b = client(m.fn)
    await b.documents.issue({ ...FR, payment: { method: 'cash', amountReceived: 200 } })
    await b.documents.issue({ ...FR, payment: { method: 'transfer' } })
    expect((m.calls[0]!.body as { payment: unknown }).payment).toEqual({ method: 'cash', amountReceived: 200 })
    expect((m.calls[1]!.body as { payment: unknown }).payment).toEqual({ method: 'transfer' })
  })

  it('o detalhe traz os meios, o valor entregue e o método misto', async () => {
    const detail = {
      id: 9,
      paymentMethod: 'mixed',
      amountReceived: 150,
      payable: 114,
      payments: [
        { method: 'debit_card', amount: 50 },
        { method: 'cash', amount: 100 },
      ],
      bankDetails: null,
    }
    const m = mockFetch(json(200, detail))
    const d: DocumentDetail = await client(m.fn).documents.get(9)
    expect(d.paymentMethod).toBe('mixed')
    expect(d.payments).toHaveLength(2)
    expect((d.amountReceived ?? 0) - (d.payable ?? 0)).toBe(36) // o troco
  })
})

describe('dados bancários', () => {
  const bank = { bankName: 'BAI', holder: 'Ngola Comercial Lda', iban: 'AO06004000006789123456789', accountNumber: '', kwikKey: '923000000', expressNumber: '923000001', notes: '' }

  it('lê e grava os da empresa', async () => {
    const m = mockFetch(json(200, bank), json(200, bank))
    const b = client(m.fn)
    expect(await b.bank()).toEqual(bank)
    expect(await b.setBank({ iban: 'ao06 0040 0000 6789 1234 5678 9', bankName: 'BAI' })).toEqual(bank)
    expect(m.calls[0]!.url).toBe('https://api.test/api/v1/company/bank')
    expect(m.calls[1]!.method).toBe('PUT')
    expect(m.calls[1]!.body).toEqual({ iban: 'ao06 0040 0000 6789 1234 5678 9', bankName: 'BAI' })
  })

  it('uma fatura leva os dados da empresa, outros, ou nenhuns', async () => {
    const m = mockFetch(json(201, { id: 1 }), json(201, { id: 2 }), json(201, { id: 3 }))
    const b = client(m.fn)
    const ft: IssueDocumentRequest = { type: 'FT', clientId: 4, lines: FR.lines }
    await b.documents.issue(ft)
    await b.documents.issue({ ...ft, bankDetails: { bankName: 'BFA', kwikKey: '911111111' } })
    await b.documents.issue({ ...ft, printBankDetails: false })
    const bodies = m.calls.map((c) => c.body as Record<string, unknown>)
    expect(bodies[0]).not.toHaveProperty('bankDetails')
    expect(bodies[1]!.bankDetails).toEqual({ bankName: 'BFA', kwikKey: '911111111' })
    expect(bodies[2]!.printBankDetails).toBe(false)
  })
})

describe('clientes: ordem, totais e extrato', () => {
  it('pede a lista ordenada e com totais', async () => {
    const m = mockFetch(json(200, { items: [{ id: 1, name: 'Zeta', invoiced: 228, amountDue: 228, lastInvoiceDate: '2026-11-15', documents: 2 }], page: 0, size: 50, total: 1 }))
    const page = await client(m.fn).clients.list({ sort: 'invoiced:desc', totals: true, desc: false, q: 'zeta' })
    expect(Object.fromEntries(new URL(m.calls[0]!.url).searchParams)).toEqual({ sort: 'invoiced:desc', totals: 'true', desc: 'false', q: 'zeta' })
    expect(page.items[0]!.invoiced).toBe(228)
    expect(page.items[0]!.documents).toBe(2)
  })

  const statement: ClientStatement = {
    clientId: 5,
    taxId: '5000000001',
    name: 'Ngola',
    from: '2026-11-01',
    to: '2026-11-30',
    opening: 0,
    entries: [{ date: '2026-11-03', reference: 'FT FT2026/1', type: 'FT', description: 'Fatura', debit: 114, credit: 0, balance: 114 }],
    debits: 114,
    credits: 0,
    closing: 114,
  }

  it('lê a conta corrente, e pede o PDF e o CSV', async () => {
    const m = mockFetch(
      json(200, statement),
      new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } }),
      new Response('Data;Documento\n', { status: 200, headers: { 'content-type': 'text/csv' } }),
    )
    const b = client(m.fn)
    expect((await b.clients.statement(5, { from: '2026-11-01', to: '2026-11-30' })).closing).toBe(114)
    expect(new TextDecoder().decode(await b.clients.statementPdf(5, { from: '2026-11-01' }))).toBe('%PDF-1.7')
    expect(await b.clients.statementCsv(5)).toContain('Documento')
    expect(Object.fromEntries(new URL(m.calls[0]!.url).searchParams)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(Object.fromEntries(new URL(m.calls[1]!.url).searchParams)).toEqual({ from: '2026-11-01', format: 'pdf' })
    expect(new URL(m.calls[2]!.url).searchParams.get('format')).toBe('csv')
    expect(new URL(m.calls[1]!.url).pathname).toBe('/api/v1/clients/5/statement')
  })
})
