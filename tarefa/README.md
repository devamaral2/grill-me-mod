# Tarefa: gerenciador de to-dos

**Status: rascunho.** Vira uma **versão da tarefa** só depois do piloto (ADR 0007, ADR 0011): o hash será calculado sobre `prompt.md` e a suíte de aceitação, e gravado em cada `relatorio.json`.

## O que há aqui

- `prompt.md`: o **prompt de teste**, texto único e idêntico enviado a todos os harnesses (ADR 0010). Está em inglês e traz só a especificação R1 a R15, o contrato de execução, a frase de que testes externos verificam os requisitos e o pedido do `SELF-REPORT.md`. Não deve ganhar diretrizes de método nem mencionar a suíte. Qualquer mudança nele, mesmo uma palavra, é uma nova versão da tarefa.

## Decisões de especificação que o piloto deve confirmar

Pontos em que escolhi uma regra para não deixar ambiguidade. Se o piloto ou a implementação de referência mostrar que algum é injusto, corrige-se antes de congelar.

| Req | Escolha |
|-----|---------|
| R1 | Campos desconhecidos e `status` no corpo são ignorados, nunca 400. |
| R2 | Limites: título 120, descrição 1000, até 10 tags de até 30 caracteres, sem duplicadas. Título e tags são guardados aparados (`trim`). |
| R4 | Envelope `items/total/limit/offset`; ordem padrão é a de criação, e o desempate de todas as ordenações é a ordem de criação. |
| R7 | `dueDate` nulo vai sempre para o fim, nas duas direções. |
| R9 | `PATCH` ignora `status` (a mudança é só pelo R10) e corpo sem nenhum dos 4 campos é 400. |
| R10 | Transições permitidas: `todo`↔`in_progress`, `in_progress`↔`done`. Repetir o status atual é 409, não 200. |
| R12 | Datas passadas são válidas; só o formato e o calendário real contam. |
| R13 | "Hoje" é a data UTC. `/todos/overdue` é rota fixa e convive com `/todos/{id}`. |
| R15 | Rota ou método inexistente é 404, não 405. Id que não é UUID é 404, não 400. |

## Pendências antes do piloto

- Escrever a suíte de aceitação (um ou mais testes por requisito, ligados a `R_n`).
- Escrever a implementação de referência e as versões quebradas, uma por requisito.
- Decidir a versão de Node da imagem do contêiner; o prompt não a cita.
