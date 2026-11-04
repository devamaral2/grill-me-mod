---
name: doc-runbook
description: Formato do runbook operacional. Use somente quando o grill-me-mod mandar escrever um runbook.
---

# Runbook

Arquivo: `docs/runbook/<slug>.md`. Registre com `grill_docs` (`kind: "runbook"`).

Escreva para quem opera às 3 da manhã: passos curtos, comandos exatos, resultado esperado de cada passo. Só o que a entrevista decidiu ou o código confirma; nunca invente comando, métrica ou URL. O que faltar vai em "Pendências".

```md
---
status: draft
date: AAAA-MM-DD
---

# Runbook: {O que se opera}

## Quando usar
{Sintoma ou situação que leva a este documento.}

## Pré-requisitos
{Acessos, ferramentas, quem avisar.}

## Verificar a saúde
{O que olhar e o valor esperado.}

## Procedimento
{Passos numerados. Cada um: comando, resultado esperado.}

## Reverter
{Como desfazer, e até quando é seguro.}

## Escalar
{Quando e para quem.}

## Pendências
```
