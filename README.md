# brisa-sdk

[![npm](https://img.shields.io/npm/v/brisa-sdk)](https://www.npmjs.com/package/brisa-sdk)
[![CI](https://github.com/codespace-ao/brisa-sdk-js/actions/workflows/ci.yml/badge.svg)](https://github.com/codespace-ao/brisa-sdk-js/actions/workflows/ci.yml)
[![licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)

SDK oficial da [API Brisa](https://brisa.ao/developers) para JavaScript e TypeScript: faturação certificada pela AGT (Angola), clientes, artigos, SAF-T e webhooks.

```ts
import { Brisa } from 'brisa-sdk'

const brisa = new Brisa() // lê BRISA_API_KEY

const fatura = await brisa.documents.issue({
  type: 'FR',
  lines: [{ description: 'Parafuso M8', quantity: 4, unitPrice: 100 }],
  payment: { method: 'cash', amountReceived: 500 },
})
const pdf = await brisa.documents.pdf(fatura.id, { format: 'a5' })
```

* **Sem dependências** em tempo de execução; ESM e CommonJS; tipos TypeScript incluídos.
* **Node.js 18+**, e também Deno, Bun e *edge runtimes* com `fetch`.
* **Seguro de repetir:** repete sozinho os pedidos em `429`, `502` e `503` e gera a chave de idempotência, por isso uma falha de rede nunca emite um documento duas vezes.
* **Erros que se programam:** classes por estado ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)), paginação automática e verificação da assinatura dos webhooks.

> **Atenção:** a chave de API é um segredo da empresa. Use o SDK no **servidor**; nunca a ponha numa aplicação web, móvel ou num repositório.

## Instalação

```bash
npm install brisa-sdk
```

(Ou `pnpm add`, `yarn add`, `bun add`.) Com CommonJS: `const { Brisa } = require('brisa-sdk')`.

## Início rápido

1. Na aplicação Brisa crie a **sandbox** e uma **chave de API** (`brk_sbx_...`).
2. `export BRISA_API_KEY="brk_sbx_a_sua_chave"`
3. Corra o exemplo acima. Quando funcionar, troque a chave pela da empresa real (`brk_...`): **é a chave que escolhe o ambiente**, o endereço é o mesmo.

## Documentação

O guia completo está em [`docs/`](docs/README.md), com exemplos em cURL, JavaScript e PHP:

| | |
|---|---|
| [Primeiros passos](docs/01-primeiros-passos.md) | a primeira fatura em 5 minutos |
| [Autenticação](docs/02-autenticacao.md) | chaves, permissões e ambientes |
| [Documentos](docs/03-documentos.md) | emitir, consultar, anular, creditar |
| [Pagamentos](docs/04-pagamentos.md) | no ato, depois, com vários meios |
| [Impressão](docs/05-impressao.md) | A4, A5 e rolos de 80 e 58 mm |
| [Dados bancários](docs/06-dados-bancarios.md) | como pagar, impresso nas faturas |
| [Clientes e extrato](docs/07-clientes-e-extrato.md) | totais, ordenar e imprimir o extrato |
| [Artigos e stock](docs/08-artigos-e-stock.md) | catálogo e movimentos |
| [SAF-T](docs/09-saft.md) | exportar para a AGT |
| [Webhooks](docs/10-webhooks.md) | ser avisado, com assinatura |
| [Erros](docs/11-erros.md) · [Idempotência e limites](docs/12-idempotencia-e-limites.md) | tratar falhas |
| [Sandbox e produção](docs/13-sandbox-e-producao.md) | ir para produção |
| [Guia de atualização](docs/upgrade.md) | de uma versão para outra |

A referência de todos os endpoints está em [`docs/openapi.json`](docs/openapi.json).

## Configuração

```ts
const brisa = new Brisa({
  apiKey: process.env.BRISA_API_KEY, // ou a variável BRISA_API_KEY
  baseUrl: 'https://api.brisa.ao',   // por omissão (ou BRISA_API_URL)
  timeoutMs: 30_000,                 // por tentativa
  maxRetries: 2,                     // repetições em 429/502/503 e falhas de rede
  maxRetryDelayMs: 60_000,           // um Retry-After maior do que isto não se espera
  fetch: globalThis.fetch,           // outra implementação (proxy, testes)
  headers: { 'X-Correlation-Id': 'abc' },
})
```

Cada método aceita, no fim, `{ idempotencyKey, signal, timeoutMs, maxRetries, headers }`. Qualquer outro endpoint: `brisa.request({ method, path, body })`.

## Contribuir

Contribuições são bem-vindas: correções, testes, documentação e ideias. Leia o [guia de contribuição](CONTRIBUTING.md) e o [código de conduta](CODE_OF_CONDUCT.md). Para falhas de segurança, **não abra uma issue**: siga a [política de segurança](SECURITY.md).

## Suporte

Dúvidas sobre a API: geral@codespace.ao. Falhas ou pedidos para este SDK: [issues](https://github.com/codespace-ao/brisa-sdk-js/issues).

## Licença

[MIT](LICENSE) © Codespace One Services, Ltd®
