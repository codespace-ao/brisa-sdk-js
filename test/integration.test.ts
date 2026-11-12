/**
 * Testes contra uma API Brisa real, com uma chave de SANDBOX (`brk_sbx...`): nada do que fazem tem valor fiscal.
 * Só correm com BRISA_API_KEY e BRISA_API_URL definidas, por exemplo:
 *   BRISA_API_URL=https://dev-api.brisa.ao BRISA_API_KEY=brk_sbx... npm run test:integration
 * A chave precisa das permissões de documentos, clientes, produtos, stock, impostos e SAF-T.
 */
import { describe, expect, it } from 'vitest'
import {
  Brisa,
  BrisaAuthenticationError,
  BrisaNotFoundError,
  BrisaPermissionError,
  BrisaRuleError,
  BrisaValidationError,
  type CompanyTax,
  collect,
  type LineTax,
} from '../src/index.js'

const key = process.env.BRISA_API_KEY
const url = process.env.BRISA_API_URL
const run = key && url ? describe : describe.skip

run('API Brisa (integração, sandbox)', () => {
  // made only when the suite runs (describe.skip still evaluates this body)
  const brisa = key && url ? new Brisa({ apiKey: key, baseUrl: url }) : (undefined as unknown as Brisa)
  const stamp = Date.now()
  const nif = `5${String(stamp).slice(-9)}`
  const code = `SDKJS-${stamp.toString(36).toUpperCase()}`
  const state: { clientId?: number; iva?: CompanyTax; ft?: number } = {}
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda' }).format(new Date())

  it('a chave funciona e é de sandbox', async () => {
    expect(key?.startsWith('brk_sbx')).toBe(true)
    const me = await brisa.me()
    expect(me.subject).toMatch(/^apikey:/)
    expect(Object.keys(me.grants)).toContain('invoices.issue')
    expect(brisa.rateLimit?.limit).toBeGreaterThan(0)
    const company = await brisa.company()
    expect(company.name).toMatch(/SANDBOX/)
  })

  it('catálogo: impostos e motivos de isenção', async () => {
    const taxes = await brisa.catalog.taxes()
    state.iva = taxes.find((t) => t.type === 'IVA' && t.code === 'NOR')
    expect(state.iva?.percentage).toBe(14)
    const reasons = await brisa.catalog.exemptionReasons()
    expect(reasons.some((r) => r.code === 'M00')).toBe(true)
    expect(Array.isArray(await brisa.catalog.categories())).toBe(true)
  })

  it('clientes: criar (idempotente), ler, atualizar, desativar, listar', async () => {
    const r = await brisa.request<{ id: number }>(
      { method: 'POST', path: '/api/v1/clients', body: { name: 'Cliente SDK JS', taxId: nif, clientType: 'company', country: 'AO', email: 'cliente@example.ao' } },
      { idempotencyKey: `cli-${nif}` },
    )
    expect(r.status).toBe(201)
    const again = await brisa.request<{ id: number }>(
      { method: 'POST', path: '/api/v1/clients', body: { name: 'Cliente SDK JS', taxId: nif, clientType: 'company', country: 'AO', email: 'cliente@example.ao' } },
      { idempotencyKey: `cli-${nif}` },
    )
    expect(again.replayed).toBe(true)
    expect(again.data.id).toBe(r.data.id)
    state.clientId = r.data.id
    await expect(brisa.clients.create({ name: 'Duplicado', taxId: nif })).rejects.toMatchObject({ status: 422, field: 'taxId' })
    await expect(brisa.clients.create({ name: '', taxId: '999999999' })).rejects.toBeInstanceOf(BrisaValidationError)
    const c = await brisa.clients.get(r.data.id)
    expect(c.taxId).toBe(nif)
    await brisa.clients.update(r.data.id, { name: 'Cliente SDK JS (alterado)', taxId: nif, city: 'Luanda', email: 'cliente@example.ao' })
    await brisa.clients.setActive(r.data.id, false)
    expect((await brisa.clients.get(r.data.id)).active).toBe(false)
    await brisa.clients.setActive(r.data.id, true)
    const page = await brisa.clients.list({ q: 'SDK', size: 1 })
    expect(page.size).toBe(1)
    expect(page.total).toBeGreaterThanOrEqual(1)
    await expect(brisa.clients.get(99_999_999)).rejects.toBeInstanceOf(BrisaNotFoundError)
  })

  it('produtos e stock', async () => {
    const p = await brisa.products.upsert(code, { name: 'Produto SDK JS', type: 'product', price: 1000, unit: 'un', taxes: [{ taxId: state.iva!.id, order: 1 }], trackStock: true })
    expect(p.code).toBe(code)
    const s = await brisa.products.moveStock(code, { type: 'in', quantity: 10, reason: 'Stock inicial' }, { idempotencyKey: `mov-${code}` })
    expect(s.quantity).toBe(10)
    const s2 = await brisa.products.moveStock(code, { type: 'in', quantity: 10, reason: 'Stock inicial' }, { idempotencyKey: `mov-${code}` })
    expect(s2.quantity).toBe(10) // a repetição não moveu o stock outra vez
    expect((await brisa.products.get(code)).quantity).toBe(10)
    expect((await brisa.products.list({ q: code })).items.map((x) => x.code)).toContain(code)
  })

  it('documentos: emitir FT (idempotente), consultar, PDF, exportar', async () => {
    const body = { type: 'FT' as const, clientId: state.clientId!, lines: [{ productCode: code, quantity: 2 }] }
    const k = `ft-${stamp}`
    const ft = await brisa.documents.issue(body, { idempotencyKey: k })
    expect(ft.number).toMatch(/^FT /)
    expect(ft.grossTotal).toBe(2280)
    const replay = await brisa.request<{ id: number }>({ method: 'POST', path: '/api/v1/documents', body }, { idempotencyKey: k })
    expect(replay.replayed).toBe(true)
    expect(replay.data.id).toBe(ft.id)
    await expect(brisa.documents.issue({ ...body, lines: [{ productCode: code, quantity: 3 }] }, { idempotencyKey: k })).rejects.toMatchObject({
      status: 422,
      field: 'idempotency',
    })
    await expect(brisa.request({ method: 'POST', path: '/api/v1/documents', body })).rejects.toMatchObject({ status: 400, type: 'urn:brisa:falta-o-idempotency-key' })
    state.ft = ft.id

    const d = await brisa.documents.get(ft.id)
    expect(d.lines[0]?.productCode).toBe(code)
    expect(d.amountDue).toBe(2280)
    const pdf = await brisa.documents.pdf(ft.id)
    expect(new TextDecoder().decode(pdf.subarray(0, 4))).toBe('%PDF')
    const ex = await brisa.documents.export(ft.id)
    expect(ex.documentNo).toBe(ft.number)
    expect(await brisa.documents.export(ft.id, 'xml')).toContain('<?xml')
    expect((await brisa.documents.history(ft.id)).events[0]?.action).toBe('ISSUE')
    await brisa.documents.setDueDate(ft.id, today)
    const list = await brisa.documents.list({ type: 'FT', size: 1 })
    expect(list.items).toHaveLength(1)
    const firstTwo = await collect(brisa.documents.listAll({ size: 1 }), 2)
    expect(firstTwo).toHaveLength(2)
  })

  it('documentos: FR, TV e PF com impostos na linha', async () => {
    const iva = state.iva!
    const tax: LineTax = { name: 'IVA 14%', percentage: iva.percentage, taxType: iva.type, taxCode: iva.code, calculationOrder: 1 }
    const customer = { name: 'Consumidor final', taxId: '999999999' }
    const fr = await brisa.documents.issue({
      type: 'FR',
      customer,
      lines: [{ description: 'Serviço', quantity: 1, unitPrice: 500, taxes: [tax] }],
      payment: { method: 'cash', amountReceived: 570 },
    })
    expect(fr.grossTotal).toBe(570)
    const tv = await brisa.documents.issue({
      type: 'TV',
      customer,
      lines: [{ description: 'Café', quantity: 1, unitPrice: 100, taxes: [tax] }],
      payment: { method: 'multicaixa', amountReceived: 114 },
    })
    expect(tv.number).toMatch(/^TV /)
    const pf = await brisa.documents.issue({ type: 'PF', clientId: state.clientId!, lines: [{ productCode: code, quantity: 1 }] })
    expect(pf.number).toMatch(/^PF /)
    // regras fiscais
    await expect(brisa.documents.issue({ type: 'FR', customer, lines: [{ description: 'S', quantity: 1, unitPrice: 1, taxes: [tax] }] })).rejects.toMatchObject({
      status: 422,
      field: 'payment',
    })
    await expect(
      brisa.documents.issue({ type: 'FT', customer, lines: [{ description: 'S', quantity: 1, unitPrice: 1, taxes: [{ ...tax, percentage: 14.5 }] }] }),
    ).rejects.toMatchObject({
      status: 422,
      field: 'taxes',
    })
    await expect(brisa.documents.pdf(fr.id, { format: 'thermal', copy: 'second' })).resolves.toBeInstanceOf(Uint8Array)
    await expect(brisa.documents.pdf(state.ft!, { format: 'thermal' })).rejects.toMatchObject({ status: 422, field: 'format' })
    // um talão de venda só se retifica com quem devolve
    await expect(brisa.documents.rectify(tv.id, { reason: 'Devolução' })).rejects.toMatchObject({ status: 422, field: 'customerName' })
  })

  it('pagamentos, nota de crédito, recibo global, retificação e anulação', async () => {
    const ft = state.ft!
    const paid = await brisa.documents.pay(ft, { method: 'transfer', amount: 100 })
    expect(paid.receipt?.number).toMatch(/^RC /)
    await expect(brisa.documents.pay(ft, { method: 'bitcoin' })).rejects.toMatchObject({ status: 422, field: 'method' })
    const nc = await brisa.documents.creditNote(ft, { reason: 'Devolução parcial', lines: [{ line: 1, quantity: 1 }] })
    expect(nc.number).toMatch(/^NC /)
    expect((await brisa.documents.credits(ft))[0]).toMatchObject({ credited: 1, remaining: 1 })

    const issue = () => brisa.documents.issue({ type: 'FT', clientId: state.clientId!, lines: [{ productCode: code, quantity: 1 }] })
    const [a, b] = [await issue(), await issue()]
    const rg = await brisa.documents.payGlobal({ documentIds: [a.id, b.id], method: 'transfer' })
    expect(rg.number).toMatch(/^RG /)
    await expect(brisa.documents.payGlobal({ documentIds: [a.id, a.id], method: 'transfer' })).rejects.toMatchObject({ status: 422, field: 'documentIds' })

    const c = await issue()
    const rk = `rect-${stamp}`
    const r1 = await brisa.documents.rectify(c.id, { reason: 'Erro' }, { idempotencyKey: rk })
    const r2 = await brisa.documents.rectify(c.id, { reason: 'Erro' }, { idempotencyKey: rk })
    expect(r2.id).toBe(r1.id)

    const d = await issue()
    await expect(brisa.documents.cancel(d.id, { reason: 'Teste' })).rejects.toBeInstanceOf(BrisaRuleError)
    await brisa.documents.cancel(d.id, { reason: 'Teste', basis: 'not_sent_to_acquirer' })
    expect((await brisa.documents.get(d.id)).state).toBe('cancelled')
  })

  it('SAF-T: pedir, esperar e descarregar', async () => {
    const monthStart = `${today.slice(0, 8)}01`
    await expect(brisa.saft.request({ from: monthStart, to: '2099-12-31' })).rejects.toMatchObject({ status: 422 })
    const e = await brisa.saft.request({ from: monthStart, to: today })
    expect(e.status).toBe('REQUESTED')
    const ready = await brisa.saft.waitUntilReady(e.id, { intervalMs: 2000, timeoutMs: 120_000 })
    expect(ready.documents).toBeGreaterThan(0)
    const xml = await brisa.saft.file(e.id)
    expect(xml).toContain('<AuditFile')
    expect((await brisa.saft.list()).some((x) => x.id === e.id)).toBe(true)
  })

  it('o que uma chave não pode', async () => {
    await expect(brisa.request({ method: 'GET', path: '/api/v1/webhooks' })).rejects.toBeInstanceOf(BrisaPermissionError)
    await expect(brisa.request({ method: 'GET', path: '/api/v1/api-keys' })).rejects.toBeInstanceOf(BrisaPermissionError)
    await expect(brisa.request({ method: 'GET', path: '/api/v1/nao-existe' })).rejects.toBeInstanceOf(BrisaNotFoundError)
    await expect(brisa.request({ method: 'DELETE', path: '/api/v1/documents' })).rejects.toMatchObject({ status: 405 })
    const bad = new Brisa({ apiKey: `${key!.slice(0, -2)}xx`, baseUrl: url, maxRetries: 0 })
    await expect(bad.me()).rejects.toBeInstanceOf(BrisaAuthenticationError)
  })
})
