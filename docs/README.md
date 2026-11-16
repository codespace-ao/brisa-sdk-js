# Documentação da API Brisa

A Brisa é a faturação eletrónica certificada pela AGT (Angola). Esta documentação ensina a usar a API e os SDKs para emitir faturas, receber pagamentos, imprimir, exportar o SAF-T e reagir a eventos, do primeiro pedido à produção.

Cada página começa pelo que precisa de saber, mostra o caminho mais curto com código que pode copiar, e só depois entra nos detalhes. Os exemplos aparecem sempre em **cURL**, **JavaScript** e **PHP**.

## Por onde começar

| Quero... | Leia |
|---|---|
| Emitir a minha primeira fatura em 5 minutos | [Primeiros passos](01-primeiros-passos.md) |
| Perceber como me autentico e que permissões tenho | [Autenticação](02-autenticacao.md) |
| Conhecer os tipos de documento e o que se pode fazer com cada um | [Documentos](03-documentos.md) |
| Receber pagamentos, também com vários meios no mesmo talão | [Pagamentos](04-pagamentos.md) |
| Imprimir em A4, A5 ou em rolo de 58 e 80 mm | [Impressão](05-impressao.md) |
| Pôr os dados bancários nas faturas por pagar | [Dados bancários](06-dados-bancarios.md) |
| Ver o que cada cliente deve e imprimir o extrato | [Clientes e extrato](07-clientes-e-extrato.md) |
| Gerir artigos e stock | [Artigos e stock](08-artigos-e-stock.md) |
| Exportar o SAF-T | [SAF-T](09-saft.md) |
| Ser avisado quando algo acontece | [Webhooks](10-webhooks.md) |
| Tratar erros, repetições e limites | [Erros](11-erros.md), [Idempotência e limites](12-idempotencia-e-limites.md) |
| Passar da sandbox para a produção | [Sandbox e produção](13-sandbox-e-producao.md) |
| Atualizar de uma versão anterior | [Guia de atualização](upgrade.md) |

## Como a API pensa

* **Uma API, dois ambientes.** O endereço é sempre `https://api.brisa.ao`. É a **chave** que escolhe o ambiente: `brk_sbx_...` é a sandbox (nada vai à AGT), `brk_...` é a produção.
* **Tudo o que cria é idempotente.** Repetir um pedido com o mesmo `Idempotency-Key` devolve o mesmo resultado, por isso uma falha de rede nunca emite dois documentos.
* **Erros que se podem programar.** Seguem a norma [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457): um `status`, um `type` estável e, quando é uma regra fiscal, o `field` em causa.
* **Dinheiro e datas.** Valores em kwanzas (AOA) com duas casas decimais; datas em `AAAA-MM-DD`.

## Mais

* Referência completa dos endpoints: [`openapi.json`](https://github.com/codespace-ao/brisa-sdk-js/blob/main/docs/openapi.json) (gerado do código da API) ou a página [brisa.ao/developers](https://brisa.ao/developers).
* Dúvidas e ideias: abra uma [issue](https://github.com/codespace-ao/brisa-sdk-js/issues). Quer contribuir? Leia o [guia de contribuição](../CONTRIBUTING.md).
