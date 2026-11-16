# Contribuir para o SDK JavaScript da Brisa

Obrigado por querer ajudar. Este guia diz como propor uma mudança e o que esperamos dela.

## Antes de começar

* **Falha ou ideia?** Procure primeiro nas [issues](https://github.com/codespace-ao/brisa-sdk-js/issues); se não existir, abra uma com o modelo certo.
* **Mudança grande?** Abra uma issue antes de escrever código, para combinarmos o caminho. Correções pequenas e de documentação podem ir direto num *pull request*.
* **Falha de segurança?** Não abra uma issue pública: veja [SECURITY.md](SECURITY.md).

## Preparar o ambiente

Para desenvolver precisa de Node.js 20 ou mais recente (o pacote publicado continua a funcionar a partir do Node 18; o CI confirma-o).

```bash
git clone https://github.com/codespace-ao/brisa-sdk-js.git
cd brisa-sdk-js
npm ci
npm run lint && npm run typecheck && npm test && npm run build
```

Os testes de integração correm contra a API real e só com uma chave de **sandbox**:

```bash
BRISA_API_KEY=brk_sbx_... npm run test:integration
```

Nunca ponha uma chave num commit, numa issue ou num *pull request*.

## Propor uma mudança

1. Faça um *fork* e crie um ramo a partir de `main` (`fix/erro-no-pdf`, `feat/novo-recurso`).
2. Escreva o código **e os testes**: uma correção traz o teste que falhava; um recurso traz testes do que faz e do que recusa.
3. Corra `npm run lint && npm run typecheck && npm test && npm run build`. O CI faz o mesmo.
4. Atualize a documentação em `docs/` e o `CHANGELOG.md` (secção «Não publicado»).
5. Abra o *pull request* e preencha o modelo. Explique o **porquê**, não só o quê.

Um *pull request* é aceite quando o CI passa, tem testes e um mantenedor o aprova. Pode demorar alguns dias; se ninguém responder numa semana, volte a pedir.

## Estilo

* TypeScript estrito, sem dependências em tempo de execução (é uma regra do projeto).
* Formatação e *lint* com [Biome](https://biomejs.dev): `npm run format` corrige o que for automático.
* Mensagens de *commit* no estilo convencional: `fix(pdf): ...`, `feat(clients): ...`, `docs: ...`.
* Texto para pessoas (documentação, mensagens de erro) em português de Angola; código e comentários em inglês ou português, como o ficheiro já estiver.

## Quem decide e como sai uma versão

O projeto é aberto a contribuições, mas é mantido pela Codespace: só os mantenedores (ver `.github/CODEOWNERS`) aprovam e juntam *pull requests* e publicam versões.

* `main` está protegido: só entra por *pull request*, com o CI verde, a revisão de um mantenedor e as conversas resolvidas; sem *force push*.
* Uma versão sai quando um mantenedor cria a etiqueta `vX.Y.Z` (só mantenedores o podem fazer) e aprova a publicação no ambiente `npm`. O pacote é publicado pelo GitHub Actions com **proveniência** (`npm audit signatures` confirma que veio deste repositório).
* As dependências são revistas em cada *pull request* (vulnerabilidades e licenças) e as Actions estão fixas por SHA.

## Compatibilidade

Não quebramos a API pública sem um aviso e uma entrada no [guia de atualização](docs/upgrade.md). Antes da versão 1.0 uma versão menor pode trazer mudanças, mas tentamos evitá-las.

## Código de conduta

Ao participar, aceita o [Código de Conduta](CODE_OF_CONDUCT.md).
