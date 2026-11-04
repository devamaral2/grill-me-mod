---
status: proposed
date: 2026-11-04
---

# Trabalho científico nasce de um DOI e a rede não hospeda o arquivo

Qualquer pesquisador cria a página de um trabalho científico a partir do DOI, com os metadados vindos de fontes abertas (como o Crossref) e um link para o texto original. A rede não guarda o arquivo. Isso dá um catálogo desde o primeiro dia, sem depender de autores enviando material, e evita armazenamento e questões de direitos autorais num MVP.

## Considered Options

- **Só o autor publica, com envio do arquivo**: a rede vira repositório de preprints, com custo de armazenamento e de direitos autorais, e a discussão só existe nos trabalhos de quem entrou.
- **DOI mais link e preenchimento manual**: cobriria teses e relatórios sem DOI, mas permite metadados incorretos e duplicatas.

## Consequences

- Teses, dissertações e relatórios sem DOI ficam fora do MVP.
- Sem o texto hospedado, não há como ancorar comentários em trechos do trabalho; isso motiva a discussão por eixo (ADR 0018).
- A página de um trabalho é criada sob demanda quando alguém busca um DOI ou título que ainda não existe no catálogo.
