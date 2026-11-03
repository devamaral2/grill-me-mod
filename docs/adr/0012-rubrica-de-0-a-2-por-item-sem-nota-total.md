---
status: proposed
date: 2026-11-03
---

# A rubrica pontua de 0 a 2 por item, com evidência citada, e nunca soma uma nota total

Uma escala fina (1 a 5) ou uma nota única passariam precisão que um juiz estocástico não tem, e esconderiam em qual item um harness difere. Decidimos pontuar cada um dos quatro itens de 0 a 2 (não, parcial, sim), com âncoras escritas na rubrica e citação obrigatória de um comando ou arquivo do registro como evidência. A nota da rodada é a mediana das 3 pontuações, item a item; o consolidado compara item a item e não há soma.

## Considered Options

- **1 a 5 com média ponderada**: parece mais fino, mas o peso é arbitrário e a diferença some no ruído.
- **Aprovado ou reprovado por item**: perde o "parcial", que é onde os harnesses mais divergem.

## Consequences

- Âncoras e escala entram em `relatorio.json`; mudá-las invalida as notas e exige repontuar todas as rodadas.
- Não existe ranking por rubrica, coerente com o consolidado sem ranking (ADR 0009).
