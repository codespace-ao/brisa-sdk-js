# Política de segurança

## Versões com suporte

Corrigimos falhas de segurança na versão **mais recente**. Atualize sempre que sair uma nova.

## Como reportar uma falha

**Não abra uma issue pública.** Use uma destas vias:

* O botão **Report a vulnerability** no separador *Security* deste repositório (reporte privado do GitHub).
* Ou escreva para **geral@codespace.ao** com o assunto «Segurança SDK».

Diga o que encontrou, como reproduzir, e a versão afetada. Responderemos em **3 dias úteis** e mantê-lo-emos a par até haver correção. Pedimos que nos dê um prazo razoável antes de divulgar; creditamos quem reporta, se quiser.

## O que é, e o que não é

Interessa-nos, por exemplo: fuga ou registo da chave de API, verificação de webhooks contornável, injeção de cabeçalhos ou de caminhos, dependências com vulnerabilidade.

Falhas **na API ou na aplicação Brisa** também são bem-vindas pela mesma via.

## Boas práticas para quem usa o SDK

* Use-o no **servidor**; a chave de API nunca vai para o navegador.
* Guarde a chave como segredo e dê-lhe só as permissões necessárias.
* Verifique **sempre** a assinatura dos webhooks.
