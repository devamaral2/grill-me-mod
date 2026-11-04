---
name: doc-rfc
description: Formato do RFC (Request for Comments). Use somente quando o grill-me-mod mandar escrever um RFC.
---

# RFC · Request for Comments

Arquivo: `docs/rfc/NNNN-<slug>.md`, numeração sequencial a partir do maior existente. Registre com `grill_docs` (`kind: "rfc"`).

Um RFC pede opinião antes de a decisão fechar: apresente a proposta e as alternativas com honestidade e diga o que quer ouvir. Só o que a entrevista tratou; o resto vai em "Questões em aberto".

```md
---
status: draft
date: AAAA-MM-DD
---

# RFC NNNN: {Título}

## Resumo
{A proposta em 2 ou 3 linhas.}

## Motivação
{Por que mudar, e por que agora.}

## Proposta

## Alternativas
{Cada uma com prós, contras e por que perdeu (ou ainda concorre).}

## Impacto e riscos

## Perguntas para os revisores
{O que exatamente se quer ouvir. Lista curta.}
```
