# Changelog

Todas as alterações relevantes deste pacote. Segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.2.0] - 2026-11-15

- PDF: formatos `a5` (o A4 reduzido a meia folha), `thermal80` (rolo de 80 mm, igual a `thermal`) e `thermal58` (rolo de 58 mm).
- Venda direta paga com vários meios: `payment.payments` (até 6 meios; o troco sai do numerário); o detalhe do documento traz `paymentMethod` (`mixed`), `payments` e `amountReceived`.
- Dados bancários: `brisa.bank()` e `brisa.setBank()`; `bankDetails` e `printBankDetails` ao emitir `FT` e `PF`; o detalhe traz `bankDetails`.
- Clientes: `list` com `sort`, `desc` e `totals` (e `invoiced`, `amountDue`, `lastInvoiceDate`, `documents` em cada cliente); `statement`, `statementPdf` e `statementCsv` (a conta corrente).
- Requer a API de 15 de novembro de 2026 ou posterior; contra uma API anterior, os pedidos antigos continuam a funcionar.

## [0.1.0] - 2026-11-12

Primeira versão.

- Cliente `Brisa` com chave de API (`Authorization: Bearer brk_...`), sem dependências em tempo de execução; ESM e CommonJS, Node.js 18+.
- Documentos: emitir (`FT`, `FR`, `TV`, `PF`), listar (com paginação automática), consultar, PDF, exportar (JSON/XML), pagar, recibo global, anular, retificar, nota de crédito, créditos, histórico, vencimento, envio por e-mail.
- Clientes (criar, atualizar, consultar, listar, ativar/desativar), produtos e stock, impostos, motivos de isenção, categorias, SAF-T (pedir, esperar, descarregar), `me()` e `company()`.
- `Idempotency-Key` gerado automaticamente nas criações e repetido nas repetições.
- Repetições com espera crescente em `429`, `502`, `503` e falhas de rede, respeitando `Retry-After`; tempo máximo por pedido.
- Erros RFC 9457 como classes (`BrisaRuleError`, `BrisaRateLimitError`...), com `status`, `type`, `field` e `errors`.
- `verifyWebhook` (assinatura `Brisa-Signature`, dois segredos durante a troca, tolerância de tempo) e `signWebhookPayload`.
- Testes unitários com `fetch` simulado e testes de integração contra a sandbox.
