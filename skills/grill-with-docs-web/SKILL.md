---
name: grill-with-docs-web
description: Entrevista implacável para afiar um plano ou design, que também cria a documentação (glossário e ADRs) ao longo da conversa, tudo numa página web com uma aba por pergunta. Use quando o comando /grill-me-mod pedir, ou quando o usuário quiser fazer um grill-with-docs pela página do grill-me-mod.
---

# grill-with-docs-web

É o `grill-with-docs` (as skills `grilling` + `domain-modeling`) com a página do grill-me-mod no lugar do terminal. O método é o mesmo, sem atalhos. Muda só o canal: **toda resposta sua é um objeto JSON** (veja "O JSON da rodada"), que o mod lê e transforma em abas e chats.

Responda em português do Brasil, salvo se o usuário escrever em outro idioma. Todo texto dentro do JSON vai nesse idioma.

## O JSON da rodada

O texto final de **todo turno seu** neste modo é exatamente um objeto JSON com duas chaves, sem nada antes ou depois, sem cercas de código e sem comentários:

```json
{
  "questions": [
    {
      "id": "q1",
      "short": "Rótulo curto",
      "title": "A pergunta como título",
      "ask": "O corpo da pergunta. Markdown leve. As alternativas NÃO vão aqui: vão em options.",
      "options": [
        { "label": "Primeira alternativa", "detail": "Consequência ou trade-off, em uma frase." },
        { "label": "Segunda alternativa", "detail": "..." }
      ],
      "recommended": "A",
      "rec": "Por que você recomenda essa alternativa, em uma ou duas frases.",
      "refFile": "CONTEXT.md",
      "refText": "Trecho ou fato encontrado nesse arquivo."
    },
    {
      "id": "q2",
      "reply": "Seu retorno no chat desta pergunta já existente.",
      "open": true
    }
  ],
  "generalObservation": "Uma observação que não pertence a nenhuma pergunta."
}
```

### `questions`

Lista de itens, cada um mexendo em **um chat**. O mod decide pelo `id`:

- **`id` novo** (nenhuma pergunta nem documento com ele): cria uma **pergunta nova, numa aba nova com chat próprio**. Exige `title`; `ask` e `rec` são esperados, e `options` + `recommended` sempre que houver mais de uma resposta razoável (veja "Alternativas"). `short` (2 a 4 palavras) é o rótulo da lateral. `refFile` + `refText` são a evidência (o termo do glossário que conflita, a linha do plano, o evento do código); sem evidência, deixe ambos de fora, nunca invente. Continue a numeração: `q1`, `q2`, `q3`… Nunca reuse um id para outra pergunta.
- **`id` de pergunta existente + `reply`**: o seu `reply` entra **no chat daquela pergunta** como mensagem sua. Curto, uma ideia só. Use-o para confirmar o entendimento em uma frase, confrontar um conflito (glossário, código) ou fazer a contrapergunta. Com `"open": true` o `reply` é uma dúvida ou contrapergunta: a pergunta volta de respondida para **em aberto** e o usuário precisa responder de novo. Sem `open`, a pergunta segue respondida.
- **`reply` com alternativas**: o `reply` pode trazer `options`, `recommended`, `rec`, `refFile` e `refText`, no mesmo formato de uma pergunta nova. A página desenha a sua resposta como o mesmo cartão da pergunta (alternativas clicáveis, resposta recomendada) e o clique passa a responder as alternativas dessa mensagem. Use quando o retorno for uma contrapergunta com caminhos (por exemplo, "confirma uma destas?"); não escreva as alternativas dentro do texto do `reply`. Com `reply`, esses campos pertencem ao cartão da resposta e **não** reformulam a pergunta.
- **`id` de pergunta existente + `title`/`ask`/`rec`**: reformula a pergunta, mantendo o chat e o rascunho dela.
- **`id` de documento** (o mesmo `id` de `grill_docs`) + `reply`: a sua resposta no chat do documento.

`"questions": []` é a **fronteira vazia**: não há mais nada a perguntar (veja "Quando acaba").

### Alternativas (`options`)

Quando a pergunta tem **mais de uma resposta razoável**, ofereça-as em `options` em vez de escrevê-las no `ask`. A página desenha uma caixa de seleção (como as opções do plan mode): o usuário **clica na alternativa** e a resposta é salva, sem precisar digitar nada. Ele pode, se quiser, escrever outra resposta ou pontuar no campo de texto abaixo.

- **Formato A, B, C, D, sempre.** A página dá a letra pela posição: a 1ª alternativa é A, a 2ª é B, e assim por diante. **Nunca escreva a letra** nem numeração (`A)`, `1.`, `-`) no `label`, no `ask` ou no `rec`; para se referir a uma alternativa no texto, diga "a alternativa B".
- **De 2 a 4 alternativas** (no máximo 8, só se for inevitável). Mutuamente exclusivas, e todas razoáveis: não ponha uma alternativa de enfeite para a recomendada ganhar.
- `label` curto (uma linha, o nome da escolha). `detail` opcional, uma frase com a consequência ou o trade-off.
- `recommended` é a **letra** da alternativa recomendada (`"B"`). O `rec` passa a ser o **porquê** da recomendação, não uma resposta a ser aceita por "sim". Se a letra não existir em `options`, a recomendação é ignorada.
- Pergunta de sim ou não também é uma pergunta com alternativas: `options` = Sim / Não (por exemplo, a oferta de ADR). A recomendada é a que você escolheria.
- Pergunta realmente aberta ("qual nome você quer dar a isso?", "descreva o cenário") fica **sem** `options`; o `rec` segue sendo a resposta que um "sim" aceita.
- O que a página te devolve em `[grill-me-mod] O usuário enviou...` é `Resposta: B — <label>`, mais o que ele tenha escrito depois (ressalvas, outra ideia). Trate a ressalva como parte da resposta: se ela contradiz a alternativa, confronte no `reply`.
- Reformular `options` de uma pergunta existente (mesmo `id`) troca as alternativas; reenvie a lista inteira e o `recommended`.

### `generalObservation`

Texto (markdown leve) que você manda **toda vez que achar importante fazer uma observação geral, que não se liga a nenhuma pergunta específica**: um risco que atravessa várias decisões, uma contradição entre respostas de abas diferentes, uma dependência que o plano esqueceu, o resumo do entendimento compartilhado. A página guarda cada observação à parte, fora dos chats. Quando não houver nada assim, mande `""` ou omita a chave. Não a use para o que cabe no chat de uma pergunta.

### Regras do canal

- Nada de texto fora do JSON, nem "ok" nem resumo: o terminal não é o canal. Se o JSON vier inválido, o mod pede de novo.
- Strings JSON com `\n` para quebra de linha e `\"` para aspas. Nunca vírgula sobrando.
- Mandar um `reply` para todas as respostas recebidas é o normal; um item sem `reply` e sem campos de pergunta não faz nada.

## Como a entrevista funciona

### As rodadas (a skill `grilling`)

Entreviste o usuário sem trégua até chegarem a um **entendimento compartilhado**. Mapeie o plano como uma **árvore de decisão**: cada decisão ramifica nas decisões que dependem dela.

Trabalhe a árvore em **rodadas**. A **fronteira** é toda decisão cujos pré-requisitos já estão resolvidos: as perguntas que você pode fazer _agora_ sem adivinhar respostas que ainda não ouviu. Faça a fronteira inteira numa rodada, publicando cada pergunta como item novo de `questions`, cada uma com a sua recomendação (`recommended` + `rec`). Depois encerre o turno e espere: o usuário responde nas abas (a página só salva) e envia tudo junto. Você recebe as respostas de uma vez, num prompt `[grill-me-mod] O usuário enviou N resposta(s)...`.

Formule cada pergunta de modo que aceitar a sua recomendação seja um clique (alternativa recomendada) ou um "sim" (pergunta aberta). Uma pergunta cuja resposta depende de outra ainda aberta nesta rodada pertence a uma rodada _posterior_.

Cada rodada respondida remodela a árvore: decisões resolvidas empurram a fronteira para fora e liberam as que dependiam delas. Recalcule a fronteira e devolva a próxima rodada: um item com `reply` para cada resposta recebida (e `open: true` onde o retorno for uma dúvida), mais os itens novos da fronteira recalculada, tudo no mesmo JSON.

**Fatos são trabalho seu, nunca do usuário.** Quando uma pergunta da fronteira precisa de um fato do ambiente (arquivos, ferramentas, código), despache um subagente com contexto novo para achá-lo; não pergunte ao usuário o que você pode descobrir. Não trave nele: uma exploração em andamento é um pré-requisito em aberto, então só as perguntas que dependem dela esperam; pergunte já o resto da fronteira. As _decisões_ são do usuário: ponha cada uma para ele e espere.

### Quando acaba

A sessão acaba quando a fronteira está vazia: todo ramo da árvore visitado, nada deixado em silêncio como suposição. Nessa rodada devolva `"questions": []` e, em `generalObservation`, o entendimento compartilhado em poucas linhas, pedindo a confirmação do usuário. **Não aja sobre o plano** (não implemente nada) até o usuário confirmar. Esta skill só produz o glossário e as ADRs.

### A disciplina de domínio (a skill `domain-modeling`)

Construa e afie o modelo de domínio do projeto enquanto entrevista. É a disciplina _ativa_: desafiar termos, inventar cenários de borda e escrever glossário e decisões no momento em que cristalizam.

Antes de publicar a primeira rodada, prepare o terreno: leia `GLOSSARY-MAP.md` (vários contextos), `GLOSSARY.md` ou `CONTEXT.md` na raiz, os ADRs em `docs/adr/` e o código e os documentos que o plano citar. Use o arquivo de linguagem que existir; se nenhum existir, crie `CONTEXT.md` quando o primeiro termo for resolvido. Crie os arquivos só quando houver algo a escrever (e `docs/adr/` só na primeira ADR).

Durante a sessão, ao formular perguntas e ao receber respostas:

- **Confronte o glossário.** Se o usuário usa um termo que conflita com o glossário, diga na hora: "o glossário define 'cancelamento' como X, mas você parece querer dizer Y. Qual vale?"
- **Afie a linguagem vaga.** Proponha o termo canônico: "você diz 'conta': é o Cliente ou o Usuário? São coisas diferentes."
- **Teste com cenários concretos** que forcem os limites entre conceitos.
- **Cruze com o código.** Se o que o usuário afirma contradiz o código, mostre a contradição.
- **Atualize o glossário na hora.** Quando um termo se resolve (ao receber a resposta que o resolve), edite o arquivo de linguagem **naquele turno**, sem acumular para o fim. Use o formato de [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md): opinativo, definições de uma ou duas frases, `_Avoid_` para os sinônimos rejeitados, **nenhum detalhe de implementação**. Não é spec, rascunho nem repositório de decisões de implementação; edite o que existe sem reescrever o que não mudou.
- **Ofereça ADRs com parcimônia.** Só ofereça uma ADR quando as três coisas forem verdadeiras: (1) **difícil de reverter**, (2) **surpreendente sem contexto**, (3) **resultado de um trade-off real**. Falta uma, não ofereça. A oferta é uma **pergunta na rodada** ("Registramos isto numa ADR?", `options` Sim / Não, `recommended` "A", `rec` com o porquê); só escreva a ADR depois que o usuário aceitar. Formato em [ADR-FORMAT.md](./ADR-FORMAT.md), em `docs/adr/NNNN-slug.md`, numeração sequencial a partir da maior existente. Nesta skill toda ADR leva frontmatter, porque a página usa o status:

```md
---
status: proposed
date: AAAA-MM-DD
---

# Título curto da decisão

Contexto, decisão e porquê.
```

`status: proposed` até o usuário aprovar na página.

### Registrar os documentos na página

Depois de escrever ou alterar um arquivo, **no mesmo turno**, chame a ferramenta `grill_docs` com `id` estável, `kind` (`glossary` ou `adr`), `label` ("Linguagem ubíqua", "ADR 0014"), `path` relativo à raiz do projeto e `summary` ("3 termos novos · 1 alterado", "Novo · status Proposto"). Para o glossário, envie também `terms` com **todos os termos que mudaram na entrevista até agora** (`tag`: `Novo` ou `Alterado`, `def`, `avoid`, e `was` com a definição anterior quando `Alterado`). A página lê o arquivo do disco para a pré-visualização. `grill_docs` é só o registro: a sua resposta continua sendo o JSON da rodada.

## Os avisos do mod

Além do envio das respostas, o mod fala com você por prompts que começam com `[grill-me-mod]`. Responda a todos com o JSON da rodada:

- `Pedido do usuário sobre o documento ...`: se for ajuste, edite o arquivo, registre de novo com `grill_docs` (o documento volta para revisão) e explique o que mudou num item com o `id` do documento e `reply`. Se for pergunta, só o `reply`.
- `O usuário aprovou ...` de uma ADR: troque `status` para `accepted` no arquivo e registre de novo com `grill_docs` e `keepApproved: true`, para o documento seguir aprovado. Devolva `"questions": []`.
- `O usuário concluiu os documentos`: devolva `"questions": []` e, em `generalObservation`, um resumo de 3 linhas do que foi criado. Fim.

## Regras

- Não aja sobre o plano até o usuário confirmar o entendimento compartilhado.
- Uma pergunta por aba, uma decisão por pergunta.
- Você só fala quando o usuário envia, e fala uma vez só: um JSON em lote por turno.
- A única ferramenta `grill_*` de escrita é `grill_docs`; `grill_state` relê o estado (depois de compactação, ou se perder o fio). Se elas não existirem, o mod `grill-me-mod` não está carregado: diga isso numa linha e pare.
