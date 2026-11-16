# Documentos

Um **documento** é o que a AGT certifica: uma fatura, um recibo, uma nota de crédito. Esta página mostra os tipos, como emitir, consultar, anular e corrigir.

## Os tipos

| Tipo | Nome | Para quê |
|---|---|---|
| `FT` | Fatura | vender a crédito; fica por pagar até haver recibo |
| `FR` | Fatura-recibo | venda paga no ato |
| `TV` | Talão de venda | venda paga no ato, ao balcão |
| `PF` | Fatura pró-forma | orçamento sem validade fiscal |
| `NC` | Nota de crédito | devolver ou corrigir parte de um documento |
| `RC` / `RG` | Recibo / recibo global | liquidar uma ou várias faturas |

`NC`, `RC` e `RG` têm as suas próprias operações; `POST /api/v1/documents` emite `FT`, `FR`, `TV` e `PF`.

## Emitir

```bash
curl https://api.brisa.ao/api/v1/documents -H "Authorization: Bearer $BRISA_API_KEY" -H "Idempotency-Key: encomenda-77" \
  -H "Content-Type: application/json" \
  -d '{"type":"FT","clientId":42,"paymentTermsDays":30,"lines":[{"productCode":"PAR-M8","quantity":10}]}'
```

```ts
const ft = await brisa.documents.issue({
  type: 'FT', clientId: 42, paymentTermsDays: 30,
  lines: [{ productCode: 'PAR-M8', quantity: 10 }],
}, { idempotencyKey: 'encomenda-77' })
```

```php
$ft = $brisa->documents->issue([
    'type' => 'FT', 'clientId' => 42, 'paymentTermsDays' => 30,
    'lines' => [['productCode' => 'PAR-M8', 'quantity' => 10]],
], ['idempotencyKey' => 'encomenda-77']);
```

Cada linha pode usar um artigo do catálogo (`productCode`) ou ser escrita à mão (`description`, `unitPrice` e `taxes`). Um cliente pode ser um registado (`clientId`) ou escrito no próprio documento (`customer`).

> **Nota:** a numeração e a cadeia de assinaturas são da Brisa. Nunca tente numerar documentos do seu lado.

## Consultar

```bash
curl https://api.brisa.ao/api/v1/documents/ID -H "Authorization: Bearer $BRISA_API_KEY"
```

```ts
const d = await brisa.documents.get(ft.id)
for await (const x of brisa.documents.listAll({ type: 'FT', from: '2026-11-01' })) console.log(x.number, x.amountDue)
```

```php
$d = $brisa->documents->get($ft['id']);
foreach ($brisa->documents->listAll(['type' => 'FT', 'from' => '2026-11-01']) as $x) echo $x['number'], PHP_EOL;
```

`amountDue` diz quanto falta pagar. `agtStatus` diz em que ponto está a comunicação à AGT.

## Anular, retificar e creditar

* **Anular** uma fatura emitida só é possível com o fundamento do Art. 8.º n.º 8 do Decreto Presidencial 71/25.
* **Retificar** emite a nota de crédito que anula o documento e deixa-o corrigir os dados do cliente.
* **Nota de crédito** de linhas: devolve parte do documento.

```ts
await brisa.documents.cancel(ft.id, { reason: 'Emitida por engano', basis: 'not_sent_to_acquirer' })
await brisa.documents.creditNote(ft.id, { reason: 'Devolução', lines: [{ line: 1, quantity: 2 }] })
```

```php
$brisa->documents->cancel($ft['id'], ['reason' => 'Emitida por engano', 'basis' => 'not_sent_to_acquirer']);
$brisa->documents->creditNote($ft['id'], ['reason' => 'Devolução', 'lines' => [['line' => 1, 'quantity' => 2]]]);
```

## Próximos passos

[Pagamentos](04-pagamentos.md) · [Impressão](05-impressao.md) · [Dados bancários](06-dados-bancarios.md)
