---
status: proposed
date: 2026-11-03
---

# O juiz é um modelo Claude de versão fixa, chamado direto pela API

A ADR 0008 exige um juiz único e cego, mas não escolhe o modelo. Decidimos usar um modelo Claude de versão fixa, chamado direto pela API fora de qualquer harness, com 3 pontuações e o registro anonimizado. Ele é o mesmo para todos, o que importa mais do que a escolha em si, e o relatório declara o risco de viés de afinidade com os harnesses e modelos do mesmo fornecedor.

## Considered Options

- **Modelo de outro fornecedor**: só troca o lado do viés.
- **Dois juízes de fornecedores diferentes**: reduz o viés, mas dobra o custo e produz pareceres divergentes para reconciliar.

## Consequences

- O harness claude e o juiz são do mesmo fornecedor; a anonimização reduz, mas não elimina, a vantagem possível.
- Trocar de versão do juiz muda todas as notas e exige repontuar tudo.
