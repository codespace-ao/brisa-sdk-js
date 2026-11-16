# Dados bancários

Uma fatura por pagar pode trazer impresso **como pagar**: banco, titular, IBAN, número de conta, chave Kwik e Multicaixa Express. Saem em «Dados Bancários», ao lado das notas.

## Definir os da empresa

```bash
curl -X PUT https://api.brisa.ao/api/v1/company/bank -H "Authorization: Bearer $BRISA_API_KEY" -H "Content-Type: application/json" \
  -d '{"bankName":"BAI","holder":"Ngola Comercial, Lda","iban":"AO06 0000 0000 0000 0000 0000 0","kwikKey":"923000000"}'
```

```ts
await brisa.setBank({ bankName: 'BAI', holder: 'Ngola Comercial, Lda', iban: 'AO06 0000 0000 0000 0000 0000 0', kwikKey: '923000000' })
const bank = await brisa.bank()
```

```php
$brisa->setBank(['bankName' => 'BAI', 'holder' => 'Ngola Comercial, Lda', 'iban' => 'AO06 0000 0000 0000 0000 0000 0', 'kwikKey' => '923000000']);
```

Todos os campos são opcionais e têm uma linha cada. O IBAN guarda-se **como foi escrito** (até 60 caracteres). Enviar tudo vazio limpa os dados. Precisa da permissão `settings.manage`.

## Em cada fatura

* Sem mais nada, uma `FT` ou `PF` leva os dados da empresa.
* `bankDetails` dá outros só para essa fatura.
* `printBankDetails: false` não imprime nenhuns.

```ts
await brisa.documents.issue({ type: 'FT', clientId: 42, lines })                                   // os da empresa
await brisa.documents.issue({ type: 'FT', clientId: 42, lines, bankDetails: { bankName: 'BFA' } })  // só nesta fatura
await brisa.documents.issue({ type: 'FT', clientId: 42, lines, printBankDetails: false })           // nenhuns
```

```php
$brisa->documents->issue(['type' => 'FT', 'clientId' => 42, 'lines' => $lines, 'printBankDetails' => false]);
```

## O que convém saber

* Os dados ficam **copiados** na fatura quando é emitida: mudar os da empresa depois não altera as já emitidas.
* Só aparecem enquanto há algo por pagar. Uma fatura paga, um `FR` ou um `TV` não os imprimem.
