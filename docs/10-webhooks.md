# Webhooks

Em vez de perguntar à API se algo mudou, deixe que a Brisa o avise. Cada evento é um `POST` ao endereço que registar.

## Eventos

`document.issued`, `document.cancelled`, `document.credited`, `document.rectified`, `document.agt.validated`, `document.agt.rejected` e `document.agt.cancel_rejected`.

Os webhooks registam-se na aplicação (não com a chave de API). O segredo (`whsec_...`) é mostrado uma única vez.

## Verificar a assinatura

> **Atenção:** verifique **sempre** a assinatura, sobre o corpo **bruto** (antes de o converter em JSON). Sem isso qualquer pessoa pode fingir ser a Brisa.

```ts
import express from 'express'
import { BrisaWebhookSignatureError, verifyWebhook } from 'brisa-sdk'

app.post('/webhooks/brisa', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = await verifyWebhook(req.body, req.get('Brisa-Signature'), process.env.BRISA_WEBHOOK_SECRET!)
    res.sendStatus(200) // responda depressa (menos de 10 s)
  } catch (e) {
    if (e instanceof BrisaWebhookSignatureError) return res.sendStatus(400)
    throw e
  }
})
```

```php
use Brisa\Webhook;

$event = Webhook::verify(file_get_contents('php://input'), $_SERVER['HTTP_BRISA_SIGNATURE'] ?? null, getenv('BRISA_WEBHOOK_SECRET'));
http_response_code(200);
```

## Boas práticas

* **Entrega "pelo menos uma vez".** Guarde o `event.id` e ignore os repetidos.
* **Responda depressa** e trate o trabalho pesado fora do pedido.
* **Troca de segredo:** durante a troca chegam duas assinaturas; passe os dois segredos (`[novo, antigo]`) à verificação.
* **Teste o seu endpoint** com `signWebhookPayload(corpo, segredo)` (JS) ou `Webhook::sign($corpo, $segredo)` (PHP), que geram um cabeçalho válido.
