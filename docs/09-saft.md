# SAF-T

O SAF-T (AO) é o ficheiro de auditoria que a AGT pede. A Brisa gera-o em segundo plano para o período que escolher.

```bash
curl https://api.brisa.ao/api/v1/saft/exports -H "Authorization: Bearer $BRISA_API_KEY" -H "Content-Type: application/json" -d '{"from":"2026-10-01","to":"2026-10-31"}'
```

```ts
const pedido = await brisa.saft.request({ from: '2026-10-01', to: '2026-10-31' })
await brisa.saft.waitUntilReady(pedido.id)  // espera, com intervalos, até estar pronto
const xml = await brisa.saft.file(pedido.id)
```

```php
$pedido = $brisa->saft->request('2026-10-01', '2026-10-31');
$brisa->saft->waitUntilReady($pedido['id']);
file_put_contents('saft-2026-10.xml', $brisa->saft->file($pedido['id']));
```

> **Nota:** pedir o ficheiro antes de estar pronto devolve `409`. O `waitUntilReady` evita isso.

O período tem de ser do ano corrente, com a data inicial antes da final e sem datas futuras. Precisa da permissão `saft.export`.
