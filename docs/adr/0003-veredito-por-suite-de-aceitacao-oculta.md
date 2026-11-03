---
status: proposed
date: 2026-11-02
---

# O veredito vem de uma suíte de aceitação que o harness nunca vê

Quando o harness escreve o próprio código, ele também pode escrever testes que passam por construção, então os testes dele não provam nada. Decidimos que o veredito vem de uma suíte de aceitação nossa, rodada por HTTP contra a aplicação gerada, com cada teste ligado a um requisito (R_n). O veredito é aprovado ou reprovado (build quebrado, servidor que não sobe ou estouro dos 30 minutos reprovam) e o relatório mostra a fração de requisitos atendidos.

## Considered Options

- **Suíte visível no diretório de partida, proibida de alterar**: simples e é o modelo anterior, mas o harness pode moldar o código aos testes e a proibição de editar não cobre testes que ele cria por fora.
- **Só build, lint e testes escritos pelo próprio harness**: não mede correção contra a especificação.

## Consequences

- A suíte oculta passa a ser parte do experimento: precisa ser escrita e mantida por nós e cobrir todos os requisitos.
- Requisito ambíguo na especificação vira reprovação injusta; a especificação e a suíte precisam ser revisadas juntas.
- Se a suíte vazar para o prompt ou para o diretório da rodada, os resultados perdem validade.
