---
name: doc-brd
description: Formato do BRD (Business Requirements Document). Use somente quando o grill-me-mod mandar escrever um BRD.
---

# BRD · Business Requirements Document

Arquivo: `docs/brd/<slug>.md`. Registre com `grill_docs` (`kind: "brd"`).

Fale do negócio: por que, para quem, com que regras. Sem solução técnica. Só o que a entrevista decidiu; o resto vai em "Questões em aberto". Regras de negócio com os termos exatos do glossário.

```md
---
status: draft
date: AAAA-MM-DD
---

# {Título}

## Objetivo de negócio
{O resultado esperado e por que importa agora.}

## Stakeholders
{Quem decide, quem é afetado, quem opera.}

## Regras de negócio
{Lista numerada RN1, RN2… Cada regra diz o que muda em relação ao comportamento atual.}

## Impacto
{Receita, custo, risco, processos e times afetados.}

## Critérios de aceite do negócio
{Como o negócio confirma que a regra vale.}

## Premissas e restrições

## Questões em aberto
```
