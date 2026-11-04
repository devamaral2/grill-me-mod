# grill-me-mod

Um mod do Claude Code que roda o `grill-with-docs` numa página web.

`/grill-me-mod [tema]` abre uma página local. Cada execução começa do zero: o estado anterior é descartado e o tema é o que você escreveu no comando. O Claude publica as perguntas, uma aba por pergunta. Você escreve em cada uma, e a página só salva. Na última aba você envia tudo junto. O Claude responde sempre com um JSON (`questions` e `generalObservation`): cada item de `questions` cai no chat de uma pergunta ou vira uma aba nova, e a observação geral aparece à parte. Durante a entrevista ele não escreve arquivo nenhum. Quando não há mais o que perguntar, a página passa para a **Seleção**: você marca os conceitos que entram na linguagem ubíqua (como tags), confirma o título de cada ADR e escolhe quais documentos adicionais (TDD, PRD, BRD, RFC, runbook) valem a pena, com a sugestão do Claude para cada um. Só então os arquivos são escritos e a página de documentos mostra cada um, com chat para pedir ajustes, aprovação e um botão que abre o arquivo no seu editor.

## Como funciona

```
 você  ──página──▶  server.mjs ──stdout──▶  mod (register.ts) ──prompt──▶  Claude
  ▲                                              │                          │
  └──────────── .grill-me/state.json ◀──────────┴──── ferramentas grill_* ◀┘
```

- **A página** (`app/public`) é HTML, CSS e JS sem build, desenhada a partir dos mockups em `templates/`. Ela só lê `/api/state` e envia ações para `/api/action`.
- **O servidor** (`app/server.mjs`, Node sem dependências) escuta em `127.0.0.1` numa porta livre, exige um token na URL, serve a página e repassa as ações como linhas JSON no stdout.
- **O mod** (`hooks/register.ts`) registra o comando, sobe o servidor, é o único que escreve o estado (`.grill-me/state.json` na raiz do projeto, ignorado pelo git). Guarda os rascunhos sem avisar o Claude e só o aciona quando há algo a fazer: o envio da finalização (todos os rascunhos num único prompt `[grill-me-mod] ...`), os pedidos de ajuste e as aprovações de documentos (estas em lote). Ele lê o JSON que fecha cada turno do Claude (gancho `turn.complete`), distribui os itens nos chats e abas, guarda as observações gerais e controla quem está aguardando. Se o turno terminar sem um JSON válido, pede de novo (até duas vezes).
- **As ferramentas** `grill_plan` (propõe a seleção ao fim da entrevista), `grill_docs` (registra os documentos que ele escreve) e `grill_state` (relê o estado). A conversa em si é o JSON, não uma ferramenta.
- **A skill** `skills/grill-with-docs-web` é o `grill-with-docs` (`grilling` + `domain-modeling`) adaptado: a mesma árvore de decisão, a mesma disciplina de glossário e os mesmos critérios de ADR, mas publicando a árvore de uma vez pela página e escrevendo os arquivos só depois da seleção. Cada formato de documento adicional é uma skill curta própria (`doc-tdd`, `doc-prd`, `doc-brd`, `doc-rfc`, `doc-runbook`), invocada só na hora de escrever aquele documento.

## Fluxo

1. **Entrevista.** Uma aba por pergunta, com evidência (arquivo e trecho), alternativas A, B, C, D numa caixa de seleção (um clique salva a resposta; a recomendada vem marcada) e chat próprio. Pergunta aberta, sem alternativas, traz a resposta recomendada em um clique. Escrever só salva um rascunho: nenhuma volta com o Claude, nenhum token gasto. Ao responder uma pergunta pela primeira vez, a página passa para a próxima em aberto; depois da última, volta à primeira ainda em aberto ou, se não restar nenhuma, vai para a Finalização. Cada troca de tela é animada (desliza para o lado conforme o sentido; a ida para a Finalização e para os documentos sobe), e respeita `prefers-reduced-motion`. A lateral mostra o estado de cada pergunta (Em aberto, Salva, Aguardando o Claude, Com retorno).
2. **Envio e rodada.** Na Finalização, `Enviar N respostas ao Claude` manda todos os rascunhos num único prompt. O Claude responde com o JSON da rodada: um item com `reply` por resposta (vai para o chat da pergunta; com `open: true` é uma dúvida e a pergunta passa para **Em aberto**), itens com id novo (viram abas novas, depois das existentes) e, quando há algo que não pertence a nenhuma pergunta, a `generalObservation` (aparece na Finalização e acima da pergunta aberta). A página leva você à primeira pergunta em aberto. Você continua nas abas e envia de novo, e só o que é novo segue.
3. **Seleção.** Quando a fronteira esvazia (`questions: []`) e o Claude registrou a proposta (`grill_plan`), a página vai para a Seleção. Nada foi escrito ainda.
   - **Linguagem ubíqua:** cada conceito candidato é uma tag que você liga e desliga; dá para marcar ou limpar todos e acrescentar um conceito que faltou (o Claude escreve a definição).
   - **ADRs:** uma por decisão da entrevista, sempre. Cada título tem seu botão `Confirmar criação` (ou `Confirmar todas`); `Criar documentos` só libera com todas confirmadas.
   - **Documentos adicionais:** TDD, PRD, BRD, RFC e runbook, cada um com uma descrição curta e a marca `Sugerido` (com o motivo) nos que fazem sentido para o que foi decidido. Os sugeridos já vêm marcados.
4. **Documentos.** `Criar documentos` manda a seleção ao Claude num único prompt. Ele escreve só o que foi escolhido, invocando a skill de cada documento adicional na hora, e a página mostra tudo: pré-visualização lida do disco (acompanha edições feitas no editor), chat por documento, aprovar/desfazer. `Concluir e fechar` libera quando tudo está aprovado.

## Arquivos de linguagem

O arquivo de glossário é o que já existe no projeto: `GLOSSARY-MAP.md`, `GLOSSARY.md` ou `CONTEXT.md`. Se não houver nenhum, a skill cria `CONTEXT.md`. ADRs ficam em `docs/adr/NNNN-slug.md`, com `status` e `date` no frontmatter (`proposed` até você aprovar, depois `accepted`). Os documentos adicionais ficam em `docs/tdd/`, `docs/prd/`, `docs/brd/`, `docs/rfc/` e `docs/runbook/`.

## Instalar e usar

Para usar em qualquer sessão (escopo de usuário), a partir de uma cópia local do repositório:

```bash
claude plugin marketplace add /caminho/para/grill-mod
claude plugin install grill-me-mod@grill-me-mod-local
```

Para desenvolver, rode o Claude com a pasta do mod:

```bash
claude --plugin-dir /caminho/para/grill-mod
```

Depois, dentro de qualquer projeto:

```
/grill-me-mod reserva de estoque durante o checkout
```

Requer `node` no PATH. O botão "Abrir arquivo para editar" usa `xdg-open` (Linux) ou `open` (macOS); para forçar um editor, defina `GRILL_EDITOR` (por exemplo `code` ou `zed`).

## Estrutura

```
.claude-plugin/plugin.json     manifesto
hooks/register.ts              comando, servidor, ponte e ferramentas
hooks/state.ts                 o estado e suas transições (puras)
app/server.mjs                 servidor local
app/public/                    a página
skills/grill-with-docs-web/    a skill e os formatos de glossário e ADR
skills/doc-*/                  formato de cada documento adicional (TDD, PRD, BRD, RFC, runbook)
templates/                     mockups de referência do design
```
