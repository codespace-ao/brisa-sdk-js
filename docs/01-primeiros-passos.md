# Primeiros passos

Em cinco minutos vai emitir um documento de teste e guardar o PDF. Tudo corre na **sandbox**: nada é enviado à AGT e pode repetir quantas vezes quiser.

## 1. Obtenha uma chave de teste

Na aplicação Brisa, nas definições da empresa (precisa da permissão de gerir definições), crie a **sandbox** e, nela, uma **chave de API**. A chave começa por `brk_sbx_` e só é mostrada uma vez: guarde-a de imediato.

> **Atenção:** a chave é um segredo da empresa. Use-a no servidor; nunca a ponha numa aplicação web ou móvel, nem num repositório.

```bash
export BRISA_API_KEY="brk_sbx_a_sua_chave"
```

## 2. Instale o SDK (opcional)

Pode usar a API só com HTTP, mas o SDK repete pedidos falhados, gera as chaves de idempotência e dá-lhe erros com tipo.

```bash
# JavaScript / TypeScript (Node.js 18+, Deno, Bun)
npm install brisa-sdk

# PHP 8.1+
composer require codespace-ao/brisa-php
```

## 3. Confirme que a chave funciona

```bash
curl https://api.brisa.ao/api/v1/me -H "Authorization: Bearer $BRISA_API_KEY"
```

```ts
import { Brisa } from 'brisa-sdk'

const brisa = new Brisa() // lê BRISA_API_KEY
console.log(await brisa.me())
```

```php
use Brisa\Brisa;

$brisa = new Brisa(['apiKey' => getenv('BRISA_API_KEY')]);
print_r($brisa->me());
```

A resposta diz quem é a chave e que permissões tem.

## 4. Emita a primeira fatura-recibo

```bash
curl https://api.brisa.ao/api/v1/documents \
  -H "Authorization: Bearer $BRISA_API_KEY" \
  -H "Idempotency-Key: primeira-fr-001" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "FR",
    "customer": { "name": "Consumidor final", "taxId": "999999999" },
    "lines": [{ "description": "Parafuso M8", "quantity": 4, "unitPrice": 100,
                "taxes": [{ "name": "IVA 14%", "percentage": 14, "taxType": "IVA", "taxCode": "NOR", "calculationOrder": 1 }] }],
    "payment": { "method": "cash", "amountReceived": 500 }
  }'
```

```ts
const fatura = await brisa.documents.issue({
  type: 'FR',
  customer: { name: 'Consumidor final', taxId: '999999999' },
  lines: [{ description: 'Parafuso M8', quantity: 4, unitPrice: 100,
            taxes: [{ name: 'IVA 14%', percentage: 14, taxType: 'IVA', taxCode: 'NOR', calculationOrder: 1 }] }],
  payment: { method: 'cash', amountReceived: 500 },
})
console.log(fatura.number, fatura.grossTotal) // "FR FR2026/1" 456
```

```php
$fatura = $brisa->documents->issue([
    'type' => 'FR',
    'customer' => ['name' => 'Consumidor final', 'taxId' => '999999999'],
    'lines' => [['description' => 'Parafuso M8', 'quantity' => 4, 'unitPrice' => 100,
        'taxes' => [['name' => 'IVA 14%', 'percentage' => 14, 'taxType' => 'IVA', 'taxCode' => 'NOR', 'calculationOrder' => 1]]]],
    'payment' => ['method' => 'cash', 'amountReceived' => 500],
]);
echo $fatura['number'], ' ', $fatura['grossTotal'];
```

## 5. Guarde o PDF

```bash
curl https://api.brisa.ao/api/v1/documents/ID/pdf -H "Authorization: Bearer $BRISA_API_KEY" -o fatura.pdf
```

```ts
import { writeFile } from 'node:fs/promises'
await writeFile('fatura.pdf', await brisa.documents.pdf(fatura.id))
```

```php
file_put_contents('fatura.pdf', $brisa->documents->pdf($fatura['id']));
```

## Próximos passos

* Perceba as permissões da sua chave em [Autenticação](02-autenticacao.md).
* Conheça os [tipos de documento](03-documentos.md) e como [receber pagamentos](04-pagamentos.md).
* Quando tudo funcionar, siga [Sandbox e produção](13-sandbox-e-producao.md): troca-se só a chave.
