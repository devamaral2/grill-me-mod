---
status: draft
date: 2026-11-04
---

# Rede social acadêmica: MVP

## Contexto e objetivo

Construir o MVP de uma rede social para pesquisadores e docentes do Brasil, em português, cujo diferencial é a discussão científica de qualidade. A unidade central é o trabalho científico, criado a partir de um DOI, e a discussão acontece em torno dele, organizada por eixo. O MVP é exploratório e dá certo se os pesquisadores voltarem a discutir (critério de sucesso que decide quando a fase por convite termina). Este documento desenha o sistema que sustenta esse fluxo.

## Fora de escopo

- Envio e hospedagem de arquivos de trabalhos (ADR 0017).
- Trabalhos sem DOI, como teses e relatórios.
- Importação do currículo Lattes.
- Aplicativo móvel nativo.
- Feed por áreas de interesse e seguir pessoas.
- Comentários anônimos ou com pseudônimo (ADR 0019).
- Modelo de negócio e monetização.

## Design proposto

Aplicação web responsiva, com alertas por e-mail. Componentes lógicos:

- **Cadastro e verificação**: o cadastro é aberto (restrito por convite durante a fase por convite). O selo de verificado é concedido ao confirmar um e-mail institucional e perde a validade se não for reconfirmado (ADR 0016).
- **Catálogo de trabalhos**: busca por DOI ou título. Se o trabalho não existe, a rede consulta uma fonte aberta de metadados (o Crossref), cria a página e guarda só os metadados e o link original (ADR 0017).
- **Autoria reivindicada**: um pesquisador verificado pede para ser reconhecido como autor quando o nome e a instituição são compatíveis com os metadados do DOI. A confirmação é automática, sem aprovação manual.
- **Discussão**: página do trabalho com comentários agrupados por eixo (ADR 0018). Só quem tem selo vigente comenta; qualquer visitante lê (ADR 0020).
- **Acompanhar e alertas**: um pesquisador acompanha um trabalho se comentou nele, reivindicou a autoria ou clicou em seguir. Novos comentários geram alerta por e-mail aos que acompanham o trabalho.
- **Moderação**: código de conduta público, denúncia por qualquer usuário e suspensão do selo como sanção; a decisão final fica com o responsável pelo projeto enquanto a comunidade for pequena.

Fluxo principal: o pesquisador busca um DOI, a rede cria ou abre a página, ele comenta num eixo, e os que acompanham o trabalho recebem o alerta e voltam para responder.

## Dados e interfaces

Entidades (esboço, campos a detalhar):

- **Pesquisador**: nome real, e-mail institucional, instituição, data da última verificação do selo, situação do selo (vigente, expirado, suspenso).
- **Trabalho científico**: DOI (chave única), título, autores, ano, link original, metadados da fonte aberta.
- **Autoria reivindicada**: pesquisador, trabalho, data. Um pesquisador pode reivindicar vários trabalhos.
- **Comentário**: autor, trabalho, eixo, texto, comentário pai (para respostas), data.
- **Acompanhamento**: pesquisador, trabalho e motivo (comentou, autor, seguiu).
- **Denúncia**: comentário, denunciante, motivo, decisão.
- **Convite**: código, quem convidou, uso (na fase por convite).

Interfaces externas:

- Consulta de metadados por DOI e por título em fonte aberta (Crossref).
- Envio de e-mail para verificação do vínculo, reconfirmação do selo e alertas.

## Alternativas descartadas

- Hospedar o arquivo do trabalho: ADR 0017.
- Selo permanente ou obrigatoriedade de e-mail institucional no cadastro: ADR 0016.
- Fio de comentários simples ou avaliação estruturada: ADR 0018.
- Pseudônimo ou comentário anônimo: ADR 0019.
- Abertura geral desde o início ou leitura só com conta: ADR 0020.
- Aplicativo móvel nativo: descartado para o MVP porque pesquisadores leem e escrevem no computador e o e-mail cobre os alertas.

## Riscos e migração

- **Rede vazia**: sem densidade, ninguém volta. Mitigação: fase por convite em uma área ou instituição específica.
- **Metadados do DOI incompletos ou com nomes de autores ambíguos**: a reivindicação automática pode falhar ou reconhecer a pessoa errada. Reverter a autoria deve ser possível.
- **Dependência da fonte aberta de metadados**: indisponibilidade impede criar páginas novas. Páginas já criadas continuam funcionando porque guardam os metadados.
- **Exposição de nome real em leitura pública**: risco de privacidade e de LGPD; exige política clara e meio de remover comentários e conta.
- **Reconfirmação do selo**: usuários podem perder o direito de comentar por esquecimento; o fluxo precisa avisar antes da expiração.
- **Moderação depende de uma pessoa**: não escala; revisar se a comunidade crescer.
- **Ordem de entrega sugerida**: cadastro com selo, busca e criação de página por DOI, comentários por eixo, acompanhar e alertas, reivindicação de autoria, denúncia e suspensão.

## Plano de testes

- Cadastro e verificação: e-mail institucional válido concede o selo; e-mail comum não; selo expira sem reconfirmação; reconfirmação com e-mail de outra instituição funciona.
- Permissões: usuário sem selo lê mas não comenta; selo suspenso ou expirado impede novos comentários.
- Catálogo: DOI existente abre a página; DOI novo cria a página a partir da fonte aberta; DOI inválido ou fonte indisponível mostram erro claro; o mesmo DOI não gera páginas duplicadas.
- Autoria reivindicada: nome e instituição compatíveis aceitam; incompatíveis recusam.
- Discussão: comentário exige eixo; página agrupa por eixo; respostas ficam sob o comentário pai.
- Acompanhar: comentar, reivindicar autoria e seguir criam o acompanhamento; novo comentário gera alerta só para quem acompanha, e não para o autor do próprio comentário.
- Leitura pública: visitante sem login lê a página e as discussões.
- Moderação: denúncia chega ao responsável; suspensão do selo bloqueia comentar.

## Questões em aberto

- Prazo da reconfirmação do selo (a conversa citou um ano como exemplo).
- Lista de eixos e se ela é fixa ou configurável.
- Indicador operacional de "pesquisadores voltam a discutir" que encerra a fase por convite.
- Pilha tecnológica, hospedagem e serviço de e-mail.
- Como a política de privacidade e a remoção de dados atendem à LGPD, dado nome real em leitura pública.
- Que critérios definem "nome e instituição compatíveis" na reivindicação de autoria.
- Como lidar com a mudança de nome ou de instituição do pesquisador depois da reivindicação.
- Qual área ou instituição compõe a fase por convite.
