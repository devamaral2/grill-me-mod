---
status: proposed
date: 2026-11-03
---

# Autenticação mista por adaptador: chave de API quando existe, login montado só para leitura quando não

O contêiner descartável com rede liberada (ADR 0005) precisa das credenciais dos 5 harnesses, e alguns só oferecem login de assinatura. Decidimos que cada adaptador prefere chave de API por variável de ambiente e só monta o login do usuário, somente para leitura, quando o harness não tem chave. A forma usada fica registrada em cada relatório.

## Considered Options

- **Só chaves de API**: reprodutível e não expõe o home do usuário, mas deixaria de fora harnesses sem chave.
- **Sempre montar o login do host**: cobre todos, mas amplia o que o contêiner enxerga e o que o harness pode ler.

## Consequences

- Harnesses podem rodar com cobrança diferente (API versus assinatura), então o custo só se compara com cuidado.
- Um login montado fica visível ao harness dentro do contêiner, o que é risco aceito e registrado.
