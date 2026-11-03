---
status: proposed
date: 2026-11-03
---

# O juiz roda em etapa separada e idempotente; a saída segue um layout estável por versão da tarefa

Refazer a rodada para repontuar custa uma geração completa de aplicação; refazer só o juiz custa três chamadas. Decidimos que a bancada tem comandos separados para rodar (`run`), pontuar (`judge`), montar o relatório (`report`), consolidar (`consolidate`) e validar a suíte (`validate`), e que cada rodada grava em `runs/<hash-da-versão>/<harness>/<n>/` o espaço de trabalho, os fatos, a transcrição, o `SELF-REPORT.md`, o `relatorio.md` e o `relatorio.json`. O consolidado lê apenas os `relatorio.json` de um mesmo hash.

## Consequences

- O layout e o `relatorio.json` viram contrato; mudar um deles obriga a regerar relatórios e consolidado.
- Rodadas de versões diferentes ficam em pastas diferentes e não se misturam por construção.
