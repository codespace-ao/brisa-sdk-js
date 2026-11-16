# Sandbox e produção

A **sandbox** é uma cópia de brincar: nada é enviado à AGT, os números não contam e pode apagar tudo. A **produção** emite documentos certificados.

## O que muda ao passar

Só a chave. O endereço é o mesmo, `https://api.brisa.ao`; a chave escolhe o ambiente.

| | Sandbox | Produção |
|---|---|---|
| Chave | `brk_sbx_...` | `brk_...` |
| AGT | nada é enviado | comunicação em tempo real |
| Numeração | de teste | fiscal, sem saltos |
| Plano | qualquer | com acesso à API |

## Lista de verificação antes de ir para produção

1. **Faturação eletrónica ativa** na empresa (adesão na AGT e chave privada carregada na aplicação).
2. **Chave de produção** criada, com as permissões mínimas, guardada como segredo.
3. **Idempotência** em todas as criações: ver [Idempotência](12-idempotencia-e-limites.md).
4. **Webhooks** registados e com a assinatura verificada: ver [Webhooks](10-webhooks.md).
5. **Erros e limites** tratados: ver [Erros](11-erros.md).
6. Fez um **ensaio completo** na sandbox: emitir, pagar, anular, imprimir, SAF-T.

> **Nota:** a sandbox usa dados à parte. Clientes e artigos criados nela não existem em produção: crie-os também lá.
