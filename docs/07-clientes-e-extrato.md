# Clientes e extrato

Os clientes registados evitam escrever os mesmos dados em cada fatura. Esta página mostra como gerir, ordenar por quanto cada um comprou e imprimir o extrato.

## Criar e atualizar

```bash
curl https://api.brisa.ao/api/v1/clients -H "Authorization: Bearer $BRISA_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Cliente Exemplo, Lda","taxId":"5000000001","clientType":"company","email":"geral@exemplo.ao"}'
```

```ts
const { id } = await brisa.clients.create({ name: 'Cliente Exemplo, Lda', taxId: '5000000001', clientType: 'company', email: 'geral@exemplo.ao' })
await brisa.clients.update(id, { name: 'Cliente Exemplo, Lda', taxId: '5000000001', city: 'Luanda' })
```

```php
$cliente = $brisa->clients->create(['name' => 'Cliente Exemplo, Lda', 'taxId' => '5000000001', 'email' => 'geral@exemplo.ao']);
```

> **Nota:** `update` substitui tudo. Envie o corpo completo.

## Ordenar por o que cada um faturou

`totals` acrescenta a cada cliente o total faturado (`invoiced`), o que deve (`amountDue`), a data da última fatura (`lastInvoiceDate`) e o número de documentos (`documents`).

```bash
curl "https://api.brisa.ao/api/v1/clients?sort=invoiced:desc&totals=true&size=10" -H "Authorization: Bearer $BRISA_API_KEY"
```

```ts
const top = await brisa.clients.list({ sort: 'invoiced:desc', totals: true, size: 10 })
```

```php
$top = $brisa->clients->list(['sort' => 'invoiced:desc', 'totals' => true, 'size' => 10]);
```

Ordens: `name` (por omissão), `taxId`, `city`, `createdAt` e, com os totais, `invoiced`, `due`, `lastInvoice` e `documents`. Junte `:desc` para a ordem inversa.

## Extrato

O extrato é a conta corrente do cliente: faturas, notas de crédito e recibos, dia a dia, com o saldo a correr a partir de um saldo de abertura (positivo: o cliente deve).

```bash
curl "https://api.brisa.ao/api/v1/clients/5/statement?from=2026-11-01&to=2026-11-30" -H "Authorization: Bearer $BRISA_API_KEY"
curl "https://api.brisa.ao/api/v1/clients/5/statement?format=pdf" -H "Authorization: Bearer $BRISA_API_KEY" -o extrato.pdf
```

```ts
const extrato = await brisa.clients.statement(5, { from: '2026-11-01', to: '2026-11-30' })
const pdf = await brisa.clients.statementPdf(5)
const csv = await brisa.clients.statementCsv(5)
```

```php
$extrato = $brisa->clients->statement(5, ['from' => '2026-11-01', 'to' => '2026-11-30']);
$pdf = $brisa->clients->statementPdf(5);
```

Os ficheiros (PDF, CSV, Excel) exigem também a permissão `reports.export`.
