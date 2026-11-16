# Artigos e stock

Um artigo é um produto ou um serviço com preço e impostos. Quando controla o stock, cada venda desconta e cada entrada soma.

## Criar ou atualizar um artigo

O `upsert` cria o artigo se o código não existe e atualiza-o se existe. Os impostos vêm do catálogo da empresa.

```ts
const [iva] = (await brisa.catalog.taxes()).filter((t) => t.type === 'IVA' && t.code === 'NOR')
await brisa.products.upsert('PAR-M8', { name: 'Parafuso M8', type: 'product', price: 100, unit: 'un', taxes: [{ taxId: iva.id, order: 1 }], trackStock: true })
```

```php
$brisa->products->upsert('PAR-M8', ['name' => 'Parafuso M8', 'type' => 'product', 'price' => 100, 'unit' => 'un', 'trackStock' => true]);
```

## Mover stock

```ts
await brisa.products.moveStock('PAR-M8', { type: 'in', quantity: 100, reason: 'Stock inicial' })
const p = await brisa.products.get('PAR-M8') // p.quantity, p.lowStock
```

```php
$brisa->products->moveStock('PAR-M8', ['type' => 'in', 'quantity' => 100, 'reason' => 'Stock inicial']);
```

```bash
curl https://api.brisa.ao/api/v1/products/PAR-M8/movements -H "Authorization: Bearer $BRISA_API_KEY" -H "Idempotency-Key: entrada-1" \
  -H "Content-Type: application/json" -d '{"type":"in","quantity":100,"reason":"Stock inicial"}'
```

## Catálogo

* `catalog.taxes()`: os impostos da empresa. Os de uma linha têm de coincidir com um destes.
* `catalog.exemptionReasons()`: os motivos de isenção `M00`…`M94`, obrigatórios em linhas isentas.
* `catalog.categories()`.
