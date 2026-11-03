---
status: proposed
date: 2026-11-03
---

# O consolidado não monta ranking e distingue falha de infraestrutura de falha do harness

Com 3 rodadas estocásticas por harness, médias e ordenações enganam. Decidimos que o consolidado mostra taxa de aprovação, mediana, mínimo e máximo, e uma matriz requisito por harness, e declara empate quando a diferença cabe na variação observada. Falha de infraestrutura identificada pela bancada gera rodada descartada, refeita e listada no relatório; travar ou estourar o tempo é falha do harness e reprova.

## Consequences

- O consolidado pode terminar sem vencedor claro, o que é intencional.
- A bancada precisa classificar a causa de cada falha; uma classificação errada favorece ou prejudica um harness, então o critério deve ser registrado e revisável.
