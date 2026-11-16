# Idempotência e limites

## Idempotência

Imagine que emite uma fatura e a ligação cai antes de ver a resposta. Repetir sem cuidado emitiria **duas** faturas. O cabeçalho `Idempotency-Key` resolve isso: repetir um pedido com a mesma chave devolve o mesmo resultado.

A API exige-o às chaves de API em emitir, pagar, liquidar várias faturas e notas de crédito, e recomenda-o em retificar, criar cliente e mover stock.

O SDK gera uma chave sozinho e **reutiliza-a nas repetições automáticas**. Se o seu sistema também repete (uma fila, um *job*), dê uma chave **sua**, estável por operação:

```bash
curl https://api.brisa.ao/api/v1/documents -H "Idempotency-Key: encomenda-77" ...
```

```ts
await brisa.documents.issue(body, { idempotencyKey: `encomenda-${encomenda.id}` })
```

```php
$brisa->documents->issue($body, ['idempotencyKey' => 'encomenda-' . $encomenda['id']]);
```

> **Atenção:** reutilizar a chave com **outro** corpo é erro `422` (`field: "idempotency"`).

## Limites

Por omissão há 600 pedidos por minuto por chave (o PDF e o SAF-T contam como mais de um). Cada resposta traz `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset`. Num `429`, o SDK espera o tempo de `Retry-After` e repete.

Se precisa de mais, fale connosco: geral@codespace.ao.
