---
name: doc-prd
description: Formato do PRD (Product Requirements Document). Use somente quando o grill-me-mod mandar escrever um PRD.
---

# PRD · Product Requirements Document

Arquivo: `docs/prd/<slug>.md`. Registre com `grill_docs` (`kind: "prd"`).

Fale do produto, não da implementação. Só o que a entrevista decidiu; o que faltar vai em "Questões em aberto". Requisitos testáveis, um por linha.

```md
---
status: draft
date: AAAA-MM-DD
---

# {Título}

## Problema
{Quem sofre, em que situação, com que custo.}

## Usuários e cenários
{Quem usa e os 2 ou 3 cenários que importam.}

## Requisitos
{Lista numerada R1, R2… Cada um verificável.}

## Fora de escopo

## Métricas de sucesso
{Como saberemos que funcionou: número, prazo, fonte.}

## Questões em aberto
```
