---
status: proposed
date: 2026-11-02
---

# Comparar o pacote harness + modelo padrão, e não só o harness

Alguns harnesses só funcionam com os modelos do próprio fornecedor, então fixar um modelo único para todos não é possível. Decidimos que cada harness roda com o seu modelo padrão e que o resultado compara o pacote inteiro (harness + modelo), registrando o modelo usado em cada rodada.

## Considered Options

- **Mesmo modelo em todos os harnesses**: isolaria o efeito do harness, mas só funciona onde o harness aceita trocar de modelo.

## Consequences

- Uma diferença de resultado não separa o que veio do harness e o que veio do modelo.
- Resultados antigos deixam de valer quando o modelo padrão de um harness muda; por isso o modelo fica anotado em cada rodada.
