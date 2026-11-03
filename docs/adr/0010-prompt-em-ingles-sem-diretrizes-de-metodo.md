---
status: proposed
date: 2026-11-03
---

# O prompt de teste é em inglês, sem diretrizes de método e sem mencionar a suíte

Diretrizes como "escreva testes" ou "rode o servidor" medem obediência e dão pista do que é avaliado, e a suíte é oculta. Decidimos que o prompt é único, em inglês, e traz só a especificação, o contrato de execução (`npm install`, `npm start`, `PORT`), o pedido do autorrelato em `SELF-REPORT.md` com 3 seções fixas e a frase de que os requisitos serão verificados por testes externos.

## Consequences

- Mudar uma palavra do prompt muda a versão da tarefa e invalida o consolidado.
- Se o harness não tiver o hábito de verificar o próprio trabalho, a rubrica mostrará isso em vez de o prompt compensar.
