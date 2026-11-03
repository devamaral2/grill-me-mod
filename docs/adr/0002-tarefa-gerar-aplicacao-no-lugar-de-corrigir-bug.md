---
status: proposed
date: 2026-11-02
---

# A tarefa é gerar uma aplicação, não corrigir um bug

A comparação media a correção de um bug plantado num repositório. Passamos a pedir que cada harness gere do zero uma API HTTP pequena em TypeScript/Node a partir de uma especificação com cerca de 15 requisitos numerados (R1 a R15), partindo de um diretório vazio. Isso exercita planejamento, escolha de dependências e escrita de código novo, e dá ao relatório uma unidade clara (o requisito) para dizer o que foi atendido.

## Consequences

- O cenário do bug e o repositório com bug plantado saem do escopo; resultados de rodadas anteriores não são comparáveis com os novos.
- Cada rodada custa bem mais (geração completa de uma aplicação, 5 harnesses x 3 rodadas).
- Trocar de tarefa no futuro invalida o consolidado, pois requisitos e suíte de aceitação mudam juntos.
