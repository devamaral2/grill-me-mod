---
status: proposed
date: 2026-11-03
---

# Especificação e suíte são congeladas por hash e validadas por uma implementação de referência

Um requisito ambíguo reprova um harness por culpa nossa, e mudar a especificação entre rodadas invalida o consolidado sem aviso. Decidimos escrever uma implementação de referência que passa 15/15, rodar um piloto com um harness, ajustar e então congelar especificação e suíte num hash gravado em cada `relatorio.json`. O consolidado recusa misturar hashes diferentes.

## Considered Options

- **Só piloto, sem referência**: não separa falha da suíte de falha do harness.
- **Sem congelar**: permite corrigir a suíte livremente, mas torna rodadas antigas incomparáveis em silêncio.

## Consequences

- Corrigir um erro da suíte depois de congelar exige uma nova versão e refazer todas as rodadas.
- A implementação de referência e as versões quebradas de propósito (para provar que cada teste reprova o requisito certo) são manutenção nossa.
