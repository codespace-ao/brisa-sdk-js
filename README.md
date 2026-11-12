# @codespace-ao/brisa

SDK oficial da [API Brisa](https://brisa.ao/developers) para JavaScript e TypeScript: faturação certificada pela AGT (Angola), clientes, produtos, SAF-T e webhooks.

* Sem dependências em tempo de execução; ESM e CommonJS; tipos TypeScript incluídos.
* Node.js 18 ou mais recente (também Deno, Bun e *edge runtimes* com `fetch`).
* Repete sozinho os pedidos em `429`, `502` e `503` (respeitando `Retry-After`) e gera o `Idempotency-Key` das criações, para que uma repetição nunca emita um documento duas vezes.
* Erros [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) como classes, paginação automática, verificação da assinatura dos webhooks.

> **Atenção:** a chave de API é um segredo da empresa. Use o SDK no **servidor**; nunca ponha a chave numa aplicação web, móvel ou num repositório.

## Instalação

O pacote está publicado no **GitHub Packages** (registo npm privado da organização `codespace-ao`). Crie um *token* GitHub com a permissão `read:packages` e, no projeto, um ficheiro `.npmrc`:

```ini
@codespace-ao:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
export GITHUB_TOKEN=ghp_...   # token com read:packages
npm install @codespace-ao/brisa
```

(Ou `pnpm add` / `yarn add` / `bun add` com o mesmo `.npmrc`.)

## Início rápido

1. Na aplicação Brisa (definições da empresa, com permissão de gerir as definições), crie a **sandbox** e, nela, uma **chave de API** (`brk_sbx...`). A chave só é mostrada uma vez.
2. Guarde-a numa variável de ambiente:

```bash
export BRISA_API_KEY="brk_sbx_a_sua_chave"
```

3. Emita o primeiro documento:

```ts
import { Brisa } from '@codespace-ao/brisa'

const brisa = new Brisa() // lê BRISA_API_KEY (e BRISA_API_URL, se existir)

const me = await brisa.me()
console.log(me.subject, Object.keys(me.grants))

const fatura = await brisa.documents.issue({
  type: 'FR',
  customer: { name: 'Consumidor final', taxId: '999999999' },
  lines: [
    {
      description: 'Parafuso M8',
      quantity: 4,
      unitPrice: 100,
      taxes: [{ name: 'IVA 14%', percentage: 14, taxType: 'IVA', taxCode: 'NOR', calculationOrder: 1 }],
    },
  ],
  payment: { method: 'cash', amountReceived: 456 },
})
console.log(fatura.number, fatura.grossTotal) // "FR FR2026/1" 456

import { writeFile } from 'node:fs/promises'
await writeFile(`${fatura.number.replaceAll(/\W+/g, '_')}.pdf`, await brisa.documents.pdf(fatura.id))
```

Com CommonJS: `const { Brisa } = require('@codespace-ao/brisa')`.

Quando tudo funcionar, troque a chave da sandbox pela da empresa real (`brk_...`, plano Anual): nada mais muda. O endereço é o mesmo; **é a chave que escolhe o ambiente**.

## Configuração

```ts
const brisa = new Brisa({
  apiKey: process.env.BRISA_API_KEY, // obrigatório (ou a variável BRISA_API_KEY)
  baseUrl: 'https://api.brisa.ao',   // por omissão (ou BRISA_API_URL)
  timeoutMs: 30_000,                 // por tentativa
  maxRetries: 2,                     // repetições em 429/502/503 e falhas de rede
  maxRetryDelayMs: 60_000,           // um Retry-After maior do que isto não se espera: o erro sobe
  fetch: globalThis.fetch,           // outra implementação, se precisar (proxy, testes)
  headers: { 'X-Correlation-Id': 'abc' },
})
```

Cada método aceita, no fim, opções do pedido: `{ idempotencyKey, signal, timeoutMs, maxRetries, headers }`.

## Recursos

### Documentos (`brisa.documents`)

| Método | Endpoint | Permissão |
|---|---|---|
| `issue(body, opts?)` | `POST /api/v1/documents` | `invoices.issue` |
| `list(params?)` / `listAll(params?)` | `GET /api/v1/documents` | `invoices.view` |
| `get(id)` | `GET /api/v1/documents/{id}` | `invoices.view` |
| `pdf(id, { format: 'a4' \| 'thermal', copy: 'original' \| 'second' })` → `Uint8Array` | `GET /api/v1/documents/{id}/pdf` | `invoices.view` |
| `export(id, 'json' \| 'xml')` | `GET /api/v1/documents/{id}/export` | `invoices.export` |
| `pay(id, { method, amount? })` | `POST /api/v1/documents/{id}/payments` | `invoices.payments` |
| `payGlobal({ documentIds, method })` | `POST /api/v1/documents/payments/global` | `invoices.payments` |
| `cancel(id, { reason, basis })` | `POST /api/v1/documents/{id}/cancel` | `invoices.cancel` |
| `rectify(id, { reason, customerName?, customerNif? })` | `POST /api/v1/documents/{id}/rectify` | `invoices.cancel` |
| `creditNote(id, { reason, lines? })` | `POST /api/v1/documents/{id}/credit-notes` | `invoices.cancel` |
| `credits(id)` | `GET /api/v1/documents/{id}/credits` | `invoices.view` |
| `history(id)` | `GET /api/v1/documents/{id}/history` | `invoices.view` |
| `setDueDate(id, 'AAAA-MM-DD')` | `PUT /api/v1/documents/{id}/due-date` | `invoices.payments` |
| `send(id, { to?, copy? })` | `POST /api/v1/documents/{id}/send` | `invoices.send` |

```ts
// fatura com um cliente registado e produtos do catálogo
const ft = await brisa.documents.issue({ type: 'FT', clientId: 42, lines: [{ productCode: 'PAR-M8', quantity: 10 }], paymentTermsDays: 30 })

// pagamento parcial e recibo
const { receipt } = await brisa.documents.pay(ft.id, { method: 'transfer', amount: 500 })

// nota de crédito de uma linha
await brisa.documents.creditNote(ft.id, { reason: 'Devolução', lines: [{ line: 1, quantity: 2 }] })

// anular (numa fatura emitida, só com o fundamento do Art. 8.º n.º 8)
await brisa.documents.cancel(ft.id, { reason: 'Emitida por engano', basis: 'not_sent_to_acquirer' })

// todas as faturas de novembro, página a página
for await (const d of brisa.documents.listAll({ type: 'FT', from: '2026-11-01', to: '2026-11-30' })) {
  console.log(d.number, d.amountDue)
}
```

Meios de pagamento: `cash`, `credit_card`, `debit_card`, `transfer`, `check`, `multicaixa`, `other`.

### Clientes (`brisa.clients`)

```ts
const { id } = await brisa.clients.create({ name: 'Cliente Exemplo, Lda', taxId: '5000000001', clientType: 'company', email: 'geral@exemplo.ao' })
await brisa.clients.update(id, { name: 'Cliente Exemplo, Lda', taxId: '5000000001', city: 'Luanda' }) // o PUT substitui tudo: envie o corpo completo
await brisa.clients.setActive(id, false)
const page = await brisa.clients.list({ q: 'Exemplo', activeOnly: false, size: 50 })
const c = await brisa.clients.get(id)
```

### Produtos e stock (`brisa.products`)

```ts
const [iva] = (await brisa.catalog.taxes()).filter((t) => t.type === 'IVA' && t.code === 'NOR')
await brisa.products.upsert('PAR-M8', { name: 'Parafuso M8', type: 'product', price: 100, unit: 'un', taxes: [{ taxId: iva.id, order: 1 }], trackStock: true })
await brisa.products.moveStock('PAR-M8', { type: 'in', quantity: 100, reason: 'Stock inicial' })
const p = await brisa.products.get('PAR-M8') // p.quantity, p.lowStock
for await (const x of brisa.products.listAll({ activeOnly: true })) console.log(x.code)
```

### Catálogo (`brisa.catalog`)

* `taxes({ activeOnly? })`: os impostos da empresa. Os impostos de uma linha têm de coincidir com um destes (tipo, código, percentagem e retenção).
* `exemptionReasons()`: os motivos de isenção `M00`…`M94` (obrigatórios em linhas isentas).
* `categories()`.

### SAF-T (`brisa.saft`)

```ts
const pedido = await brisa.saft.request({ from: '2026-10-01', to: '2026-10-31' })
await brisa.saft.waitUntilReady(pedido.id)            // gera-se em segundo plano
const xml = await brisa.saft.file(pedido.id)          // o ficheiro SAF-T (AO)
```

### Conta

* `brisa.me()`: quem é a chave (`apikey:<id>`) e as permissões.
* `brisa.company()`: os dados da empresa da chave.
* `brisa.rateLimit`: `{ limit, remaining, reset }` da última resposta.

### Outros pedidos

`brisa.request()` faz qualquer pedido com a mesma autenticação, repetições e erros, e devolve também o estado e os cabeçalhos:

```ts
const r = await brisa.request<{ id: number }>({ method: 'POST', path: '/api/v1/clients', body: { name: 'X', taxId: '999999999' } }, { idempotencyKey: 'cliente-x-1' })
r.status // 201
r.replayed // true se foi a repetição de um pedido anterior com o mesmo Idempotency-Key
```

## Idempotência

A API exige o cabeçalho `Idempotency-Key` às chaves de API em emitir, pagar, liquidar várias faturas e nota de crédito (e recomenda-o em retificar, criar cliente e mover stock). O SDK gera um (`brisa-js-<uuid>`) em todas estas operações e **reutiliza-o nas repetições automáticas**, para que um `503` ou uma falha de rede nunca dupliquem um documento.

Se o seu sistema também repete (uma fila, um *job*), passe um identificador **seu**, estável, por operação:

```ts
await brisa.documents.issue(body, { idempotencyKey: `encomenda-${encomenda.id}` })
```

Repetir com a mesma chave devolve o mesmo documento; reutilizá-la com outro corpo é `422` (`field: "idempotency"`).

## Erros

Todos os erros da API são instâncias de `BrisaApiError` (e de `BrisaError`), com os membros do documento RFC 9457:

| Classe | Estado | Quando |
|---|---|---|
| `BrisaValidationError` | 400 | corpo inválido; `errors` = `{ campo: mensagem }` |
| `BrisaAuthenticationError` | 401 | chave inválida, revogada, expirada, de outro IP |
| `BrisaPlanError` | 402 | plano sem API, limite do plano (`metric`, `limit`), subscrição inativa |
| `BrisaPermissionError` | 403 | a chave não tem a permissão |
| `BrisaNotFoundError` | 404 | não existe (ou é do outro ambiente) |
| `BrisaConflictError` | 409 | ainda não está pronto (ex.: SAF-T a gerar) |
| `BrisaRuleError` | 422 | regra fiscal; `field` diz o campo |
| `BrisaRateLimitError` | 429 | demasiados pedidos; `retryAfter` em segundos |
| `BrisaServerError` | 5xx | AGT ou serviço indisponível |
| `BrisaConnectionError` / `BrisaTimeoutError` | — | rede / tempo esgotado |

```ts
import { BrisaApiError, BrisaRuleError } from '@codespace-ao/brisa'

try {
  await brisa.documents.issue(body)
} catch (e) {
  if (e instanceof BrisaRuleError && e.field === 'eventDate') {
    // fora do prazo: confirmar com lateIssue: true, se for o caso
  } else if (e instanceof BrisaApiError) {
    console.error(e.status, e.type, e.field, e.detail, e.errors)
  } else throw e
}
```

Programe contra `status`, `type` (`urn:brisa:...`) e `field`; o texto de `detail` é em português e pode mudar. Os `429`, `502` e `503` já foram repetidos `maxRetries` vezes quando o erro chega até si.

## Webhooks

A Brisa avisa o seu servidor quando algo acontece (`document.issued`, `document.cancelled`, `document.credited`, `document.rectified`, `document.agt.validated`, `document.agt.rejected`, `document.agt.cancel_rejected`). Os webhooks registam-se na aplicação (não com a chave); o segredo (`whsec_...`) é mostrado uma vez.

Verifique **sempre** a assinatura sobre o corpo **bruto**:

```ts
import express from 'express'
import { BrisaWebhookSignatureError, verifyWebhook } from '@codespace-ao/brisa'

const app = express()
app.post('/webhooks/brisa', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = await verifyWebhook(req.body, req.get('Brisa-Signature'), process.env.BRISA_WEBHOOK_SECRET!)
    // ignore event.id se já o tratou (a entrega é "pelo menos uma vez")
    if (event.type === 'document.issued') {
      const doc = await brisa.documents.get(event.data.documentId as number)
    }
    res.sendStatus(200) // responda depressa (menos de 10 s)
  } catch (e) {
    if (e instanceof BrisaWebhookSignatureError) return res.sendStatus(400)
    throw e
  }
})
```

* Durante a troca do segredo chegam dois `v1`: basta um coincidir. Pode passar os dois segredos: `verifyWebhook(body, header, [novo, antigo])`.
* Por omissão recusa um `t` com mais de 5 minutos de diferença (`{ toleranceSeconds }`).
* `signWebhookPayload(body, segredo)` gera um cabeçalho válido para testar o seu endpoint.
* Funciona em Node.js, Deno, Bun, Cloudflare Workers e no browser (Web Crypto).

## Limites

Por omissão 600 pedidos por minuto por chave (o PDF e o SAF-T contam como mais de um). O SDK lê `X-RateLimit-*` (`brisa.rateLimit`) e, num `429`, espera o `Retry-After` antes de repetir.

## Desenvolvimento

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run build
# testes contra a API real, com uma chave de SANDBOX:
BRISA_API_URL=https://dev-api.brisa.ao BRISA_API_KEY=brk_sbx... npm run test:integration
```

Publicar uma versão: atualizar `version` em `package.json`, `src/version.ts` e `CHANGELOG.md`, e enviar a tag `vX.Y.Z` (o *workflow* `Release` publica no GitHub Packages).

## Licença

[MIT](LICENSE) © Codespace
