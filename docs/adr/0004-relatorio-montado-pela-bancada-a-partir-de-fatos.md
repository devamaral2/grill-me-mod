---
status: proposed
date: 2026-11-02
---

# O relatório é montado pela bancada a partir de fatos capturados; o autorrelato não vale como prova

O pedido é um relatório do trabalho completo do LLM no harness. Se ele fosse escrito pelo próprio LLM, diria o que o harness quer contar, não o que aconteceu. Decidimos que a bancada monta o relatório (`relatorio.md` e `relatorio.json` por rodada) dos fatos que ela mesma captura, e que o prompt de teste pede também um autorrelato curto em arquivo separado. O relatório mostra o autorrelato rotulado como autodeclarado e confere cada afirmação contra os fatos; as divergências viram uma seção própria e não alteram o veredito. O consolidado é gerado só dos JSONs.

## Considered Options

- **Só fatos capturados**: mais confiável, mas perde as decisões e suposições que só o LLM sabe explicar.
- **Só autorrelato**: barato, mas não verificável e diferente de harness para harness.

## Consequences

- A bancada precisa capturar transcrição, comandos, arquivos, tempo e tokens de cada um dos 5 harnesses, e a riqueza dos fatos varia com o que cada harness expõe.
- O formato de `relatorio.json` vira contrato entre as rodadas e o consolidado; mudá-lo exige regerar o consolidado.
- A conferência autorrelato x fatos é uma etapa a mais e pode errar para afirmações vagas.
