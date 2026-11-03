---
status: proposed
date: 2026-11-03
---

# A rodada roda em contêiner descartável, com permissões totais e rede liberada

Sem interação humana, qualquer pedido de aprovação do harness trava a rodada até os 30 minutos e reprova por motivo alheio à qualidade. Decidimos que cada adaptador liga a flag de "aprovar tudo" do seu harness e que a rodada roda num contêiner descartável que enxerga apenas o repositório de teste, com rede liberada (npm e API do modelo). A flag usada é registrada no relatório.

## Considered Options

- **Aprovação normal do harness**: trava a rodada e mede paciência do harness, não qualidade.
- **Permissões totais direto no diretório temporário do host**: mais simples, mas um comando destrutivo atinge a máquina.

## Consequences

- O contêiner passa a ser parte da bancada e precisa de imagem com Node e dos 5 harnesses instalados.
- Rede aberta permite que o harness acesse qualquer coisa; a captura de comandos é o que registra isso.
- Os harnesses não são comparados sob o mesmo regime de permissão que usariam no dia a dia.
