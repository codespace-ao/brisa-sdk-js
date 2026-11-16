# Pagamentos

Há dois momentos: pagar **no ato** (`FR`, `TV`) e pagar **depois** (`FT`). Esta página cobre os dois e o caso de pagar com vários meios ao mesmo tempo.

Meios aceites: `cash`, `credit_card`, `debit_card`, `transfer`, `check`, `multicaixa` e `other`.

## Pagar no ato

```bash
curl https://api.brisa.ao/api/v1/documents -H "Authorization: Bearer $BRISA_API_KEY" -H "Idempotency-Key: venda-1" -H "Content-Type: application/json" \
  -d '{"type":"FR","lines":[{"description":"Cimento 50 kg","quantity":1,"unitPrice":100}],"payment":{"method":"cash","amountReceived":200}}'
```

```ts
await brisa.documents.issue({ type: 'FR', lines, payment: { method: 'cash', amountReceived: 200 } })
```

```php
$brisa->documents->issue(['type' => 'FR', 'lines' => $lines, 'payment' => ['method' => 'cash', 'amountReceived' => 200]]);
```

O troco (o que foi dado a mais) só existe em numerário.

## Pagar com vários meios

Num `FR` ou `TV` pode pagar-se parte em numerário, parte no TPA, parte por transferência (até 6 meios). O que se paga tem de cobrir o total; o **troco** sai do numerário, por isso os meios que não são numerário não podem somar mais do que o total.

```ts
const fr = await brisa.documents.issue({
  type: 'FR',
  lines: [{ description: 'Cimento 50 kg', quantity: 1, unitPrice: 100 }], // 114 com IVA
  payment: { payments: [{ method: 'debit_card', amount: 50 }, { method: 'cash', amount: 100 }] }, // 36 de troco
})
const d = await brisa.documents.get(fr.id) // d.paymentMethod === 'mixed', d.payments, d.amountReceived
```

```php
$fr = $brisa->documents->issue([
    'type' => 'FR',
    'lines' => [['description' => 'Cimento 50 kg', 'quantity' => 1, 'unitPrice' => 100]],
    'payment' => ['payments' => [['method' => 'debit_card', 'amount' => 50], ['method' => 'cash', 'amount' => 100]]],
]);
```

```bash
curl https://api.brisa.ao/api/v1/documents -H "Authorization: Bearer $BRISA_API_KEY" -H "Idempotency-Key: venda-2" -H "Content-Type: application/json" \
  -d '{"type":"FR","lines":[{"description":"Cimento 50 kg","quantity":1,"unitPrice":100}],"payment":{"payments":[{"method":"debit_card","amount":50},{"method":"cash","amount":100}]}}'
```

> **Nota:** para a AGT e o SAF-T nada muda: o documento continua a ser um só. O talão e a fatura mostram cada meio, o total pago e o troco.

## Pagar uma fatura depois

Registar um pagamento numa `FT` emite o recibo (`RC`). Pode ser parcial.

```ts
const { receipt } = await brisa.documents.pay(ft.id, { method: 'transfer', amount: 500 })
await brisa.documents.payGlobal({ documentIds: [ft.id, outra.id], method: 'cash' }) // um recibo global
```

```php
$brisa->documents->pay($ft['id'], ['method' => 'transfer', 'amount' => 500]);
$brisa->documents->payGlobal(['documentIds' => [$ft['id'], $outra['id']], 'method' => 'cash']);
```

## Erros comuns

* `422` com `field: payment.payments`: a soma não cobre o total, ou os meios sem troco passam o total.
* `422` com `field: idempotency`: reutilizou um `Idempotency-Key` com outro corpo. Ver [Idempotência](12-idempotencia-e-limites.md).
