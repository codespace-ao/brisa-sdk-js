# Erros

A API responde a falhas com um documento [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (`application/problem+json`): `status`, `type` estável (`urn:brisa:...`), `title`, `detail` em português e, conforme o caso, `field` ou `errors`.

```json
{ "type": "urn:brisa:regra-fiscal", "title": "Regra fiscal", "status": 422, "field": "payment.payments", "detail": "O que se paga não cobre o total." }
```

> **Nota:** programe contra `status`, `type` e `field`. O texto de `detail` pode mudar.

## O que cada estado quer dizer

| Estado | Classe (JavaScript) | Quando |
|---|---|---|
| 400 | `BrisaValidationError` | corpo inválido; `errors` = `{ campo: mensagem }` |
| 401 | `BrisaAuthenticationError` | chave inválida, revogada, expirada ou de outro IP |
| 402 | `BrisaPlanError` | plano sem API ou limite do plano (`metric`, `limit`) |
| 403 | `BrisaPermissionError` | a chave não tem a permissão |
| 404 | `BrisaNotFoundError` | não existe, ou é do outro ambiente |
| 409 | `BrisaConflictError` | ainda não está pronto (por exemplo, SAF-T) |
| 422 | `BrisaRuleError` | regra fiscal; `field` diz o campo |
| 429 | `BrisaRateLimitError` | demasiados pedidos; `retryAfter` em segundos |
| 5xx | `BrisaServerError` | AGT ou serviço indisponível |

## Tratar no código

```ts
import { BrisaApiError, BrisaRuleError } from 'brisa-sdk'

try {
  await brisa.documents.issue(body)
} catch (e) {
  if (e instanceof BrisaRuleError && e.field === 'eventDate') {
    // fora do prazo
  } else if (e instanceof BrisaApiError) {
    console.error(e.status, e.type, e.field, e.errors)
  } else throw e
}
```

```php
use Brisa\Exception\{RuleException, ValidationException, ApiException};

try {
    $brisa->documents->issue($pedido);
} catch (ValidationException $e) { // 400: $e->errors()
} catch (RuleException $e) {       // 422: $e->field()
} catch (ApiException $e) {        // os outros: $e->status(), $e->type()
}
```

Os `429`, `502` e `503` já foram repetidos pelo SDK antes de o erro chegar até si.
