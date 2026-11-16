# Guia de atualização

Cada secção diz o que mudou, o **impacto** (alto, médio ou baixo) e o que fazer. Os SDKs seguem [versionamento semântico](https://semver.org/lang/pt-BR/): antes da 1.0, uma versão menor pode trazer mudanças.

## De 0.1 para 0.2

Requer a API de 15 de novembro de 2026 ou posterior. Contra uma API anterior, os pedidos antigos continuam a funcionar.

### Impacto baixo: novos papéis de impressão

`pdf({ format })` aceita agora `a5`, `thermal80` (igual a `thermal`) e `thermal58`. Nada a fazer.

### Impacto baixo: pagamento com vários meios

`payment.payments` (até 6 meios) em `FR` e `TV`. O detalhe do documento traz `paymentMethod: "mixed"`, `payments` e `amountReceived`. Se mostra o meio de pagamento num ecrã seu, trate o valor `mixed`.

### Impacto baixo: dados bancários

`bank()`, `setBank()`, `bankDetails` e `printBankDetails` ao emitir. O IBAN guarda-se como foi escrito, sem verificação.

### Impacto baixo: clientes

`clients.list` aceita `sort`, `desc` e `totals`; novos `statement`, `statementPdf` e `statementCsv`.
