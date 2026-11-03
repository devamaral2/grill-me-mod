---
status: proposed
date: 2026-11-03
---

# A aplicação-alvo guarda dados só em memória; os requisitos são rascunho até o piloto

A especificação com os 15 requisitos (R1 a R15: criar, validar, consultar, filtrar por status e tag, alterar, transitar status, apagar, validar `dueDate`, ordenar, paginar, atrasadas, `/health`, erros) é a base da suíte, da implementação de referência e do prompt. Decidimos que a aplicação não persiste nada: reiniciar devolve o estado vazio. Sem banco, a suíte não depende de ordem de reinício nem de limpeza, e o `npm install` não puxa driver nativo que falharia por motivo alheio ao harness. A lista é rascunho até o piloto e depois é congelada por hash (ADR 0007).

## Considered Options

- **Arquivo ou SQLite**: exercitaria persistência, mas introduz ambiguidade de caminho e de reinício e dependência nativa.

## Consequences

- A tarefa não mede escolha de banco nem modelagem de persistência.
- Trocar para persistente depois muda requisitos e suíte, ou seja, nova versão da tarefa e consolidado refeito.
