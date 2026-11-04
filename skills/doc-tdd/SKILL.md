---
name: doc-tdd
description: Formato do TDD (Technical Design Document). Use somente quando o grill-me-mod mandar escrever um TDD.
---

# TDD · Technical Design Document

Arquivo: `docs/tdd/<slug>.md`. Registre com `grill_docs` (`kind: "tdd"`).

Escreva só com o que a entrevista decidiu. O que faltar vai em "Questões em aberto", nunca inventado. Use os termos do glossário. Direto, sem enchimento: uma seção sem conteúdo é cortada.

```md
---
status: draft
date: AAAA-MM-DD
---

# {Título}

## Contexto e objetivo
{Problema técnico e o que esta mudança resolve, em 3 a 5 linhas.}

## Fora de escopo

## Design proposto
{Componentes, fluxo e responsabilidades. Um diagrama em texto só se ajudar.}

## Dados e interfaces
{Modelos, contratos, eventos, APIs que mudam ou nascem.}

## Alternativas descartadas
{Cada uma com o motivo. Aponte a ADR quando houver.}

## Riscos e migração
{O que pode dar errado, como reverter, ordem de entrega.}

## Plano de testes

## Questões em aberto
```
