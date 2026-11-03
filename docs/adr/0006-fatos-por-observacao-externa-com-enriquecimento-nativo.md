---
status: proposed
date: 2026-11-03
---

# Fatos capturados por observação externa; dados nativos só enriquecem e nunca são estimados

Os 5 harnesses expõem coisas diferentes (alguns têm eventos em JSON, outros só texto, nem todos reportam tokens). Decidimos que a base dos fatos é observada de fora e idêntica para todos (arquivos, comandos, tempo), e que transcrição, tokens e custo nativos entram só quando existem, marcados com a origem. Quando não existem aparece "n/d", nunca uma estimativa.

## Considered Options

- **Só parsear o log nativo de cada harness**: mais rico, mas diferente em cada um e frágil a mudanças de versão.
- **Estimar o que falta**: permitiria comparar custo, mas mistura dado medido com inventado.

## Consequences

- A comparação de tempo e de entrega é justa; a de tokens e custo só vale entre harnesses que os reportam.
- Cada adaptador ainda precisa de um parser opcional do formato nativo.
