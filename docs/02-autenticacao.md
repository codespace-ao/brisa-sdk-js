# Autenticação

A API autentica cada pedido com uma **chave de API** enviada como *Bearer token*. Cada chave pertence a uma empresa, tem um ambiente (sandbox ou produção) e um conjunto de permissões.

## Enviar a chave

```bash
curl https://api.brisa.ao/api/v1/me -H "Authorization: Bearer brk_..."
```

```ts
const brisa = new Brisa({ apiKey: process.env.BRISA_API_KEY })
```

```php
$brisa = new Brisa(['apiKey' => getenv('BRISA_API_KEY')]);
```

Sem a opção `apiKey`, o SDK lê a variável de ambiente `BRISA_API_KEY`.

## O que a chave pode fazer

`GET /api/v1/me` devolve as permissões ("grants") da chave, como `invoices.view`, `invoices.issue` ou `reports.export`. Um pedido sem a permissão recebe `403`. Dê a cada chave só o que a integração precisa.

| Permissão | Para quê |
|---|---|
| `invoices.view` | ler documentos e os seus PDF |
| `invoices.issue` | emitir |
| `invoices.payments` | registar pagamentos e liquidar faturas |
| `invoices.cancel` | anular, retificar e notas de crédito |
| `invoices.send` | enviar por e-mail |
| `invoices.export` | exportar JSON/XML de um documento |
| `clients.view`, `clients.manage` | ler e gerir clientes |
| `reports.export` | PDF, CSV e Excel de relatórios e extratos |
| `settings.manage` | dados da empresa e dados bancários |

## Ambientes

| Prefixo | Ambiente | Efeito |
|---|---|---|
| `brk_sbx_` | sandbox | nada vai à AGT; dados de teste |
| `brk_` | produção | documentos certificados, comunicados à AGT |

O endereço é o mesmo para os dois. Muda-se de ambiente trocando a chave.

## Boas práticas

* **Uma chave por integração**, com o mínimo de permissões. Assim pode revogar uma sem parar as outras.
* **No servidor.** Se a chave for exposta, revogue-a na aplicação e crie outra.
* **Restrinja por IP** quando o seu servidor tiver um IP fixo.
* **Guarde-a como segredo** (variável de ambiente ou cofre), nunca no código.

## Erros de autenticação

Uma chave inválida, revogada, expirada ou usada de um IP não permitido responde `401`. Uma chave sem a permissão necessária responde `403`. Ver [Erros](11-erros.md).
