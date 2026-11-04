# Comparação de harnesses

Como comparar harnesses de agente de código com um mesmo prompt de teste, para saber qual constrói melhor uma aplicação a partir de uma especificação, usa bem as ferramentas e deixa um relatório fiel do trabalho feito.

## Language

**Harness**:
A ferramenta de agente de código que recebe o prompt de teste e usa ferramentas para executar a tarefa. Hoje: claude, codex, copilot, opencode e gemini.
_Avoid_: CLI, agente, test harness

**Bancada**:
O código nosso que executa as rodadas, captura os fatos, calcula o veredito, chama o juiz e emite o relatório. Não é um harness: os harnesses são os avaliados, a bancada é quem avalia.
_Avoid_: orquestrador, executor, test harness

**Adaptador**:
A parte da bancada específica de um harness: sabe iniciá-lo sem interação humana, com todas as permissões liberadas, e ler o que ele expõe de si. Cada harness tem o seu; a flag de permissões e a forma de autenticação que o adaptador usou são registradas no relatório.
_Avoid_: driver, wrapper, plugin

**Forma de autenticação**:
Como o harness provou quem é na rodada: chave de API (preferida) ou o arquivo de credencial do usuário montado somente para leitura, quando o harness não oferece chave. Nunca o diretório inteiro de configuração. Cada adaptador declara a sua e o relatório a registra.
_Avoid_: credencial, método de login

**Configuração de fábrica**:
O estado em que o harness inicia a rodada: HOME vazio dentro do contêiner, com só a credencial. Nenhuma instrução, skill, MCP, hook ou plugin do usuário. O que for necessário apenas para rodar sem interação (modo não interativo, pular onboarding) é do adaptador e consta no relatório.
_Avoid_: configuração do usuário, ambiente limpo

**Testes próprios**:
Os testes que o harness escreveu por conta própria no espaço de trabalho. A bancada os executa (`npm test`) depois da suíte de aceitação e mostra o resultado no relatório, só como informação: nunca alteram o veredito.
_Avoid_: testes do harness, suíte de aceitação

**Rodada**:
Uma execução do prompt de teste em um harness, partindo de um repositório de teste vazio, sem interação humana e com limite de 30 minutos. Cada harness tem 3 rodadas. As rodadas rodam uma por vez, intercaladas entre os harnesses (a r1 de cada um, depois a r2 de cada um, e assim por diante).
_Avoid_: execução, tentativa, run

**Rodada descartada**:
Rodada que a bancada identificou como perdida por falha de infraestrutura (rede, contêiner) ou por cota de uso esgotada, não do harness. É refeita e fica listada no relatório; não conta entre as 3 do harness. Dois descartes seguidos do mesmo harness fazem a bancada parar e esperar o usuário.
_Avoid_: rodada inválida, retry

**Tarefa**:
O que o prompt de teste pede: gerar do zero a aplicação-alvo a partir de uma especificação com requisitos numerados.
_Avoid_: desafio, exercício

**Aplicação-alvo**:
A API HTTP de gerenciador de tarefas pessoais (to-dos) em TypeScript/Node que cada harness deve gerar. Guarda os dados só em memória: reiniciar a aplicação a devolve vazia. Não confundir "tarefa" do gerenciador, que é um dado da aplicação, com a **Tarefa** da comparação.
_Avoid_: projeto, app de teste

**Requisito**:
Cada item numerado (R1 a R15) da especificação da tarefa. Fixa método, rota, corpo e status esperados, de modo que não haja ambiguidade. É a unidade em que o veredito e o relatório dizem o que foi atendido.
_Avoid_: item, feature

**Piloto**:
A primeira rodada de um harness (claude) feita só para achar ambiguidades na especificação e na suíte antes de congelar a versão da tarefa. Não entra no consolidado.
_Avoid_: teste, rodada de ensaio

**Versão da tarefa**:
O conjunto congelado de especificação e suíte de aceitação, identificado por um hash gravado em cada relatório. Rodadas de versões diferentes não se misturam no consolidado.
_Avoid_: revisão, edição

**Contrato de execução**:
O acordo, escrito no prompt de teste, de como a suíte inicia a aplicação gerada: `npm install`, depois `npm start`, escutando na porta indicada pela variável `PORT`.
_Avoid_: instruções de build

**Prompt de teste**:
O texto único e idêntico, em inglês, enviado a todos os harnesses. Traz só a especificação com os requisitos, o contrato de execução e o pedido do autorrelato, sem diretrizes de método. Informa apenas que os requisitos serão verificados por testes externos.
_Avoid_: enunciado

**Repositório de teste**:
O diretório de partida, isolado e descartável, de onde cada rodada começa: vazio.
_Avoid_: fixture, projeto de exemplo

**Suíte de aceitação**:
Os testes escritos por nós que exercitam a aplicação gerada por HTTP, cada um ligado a um requisito. O harness nunca a vê.
_Avoid_: testes ocultos, testes do harness

**Implementação de referência**:
Uma aplicação escrita por nós que deve passar todos os requisitos da suíte; prova que a suíte e a especificação são justas antes de comparar harnesses. Acompanha **versões quebradas** de propósito, cada uma violando um requisito, para provar que o teste certo reprova.
_Avoid_: gabarito, solução

**Veredito**:
O resultado de uma rodada, dado pela suíte de aceitação: aprovado ou reprovado, mais a fração de requisitos atendidos. Build quebrado, servidor que não sobe ou estouro de tempo reprovam a rodada.
_Avoid_: nota, score

**Rubrica**:
Os itens pontuados além do veredito, para o que a suíte não pega: respeitar o escopo, usar as ferramentas com segurança, verificar o próprio trabalho e a fidelidade do autorrelato aos fatos. Cada item vai de 0 a 2 (não, parcial, sim), com âncoras escritas e citação obrigatória da evidência no registro. Vale a mediana por item e nunca há nota total. A qualidade do código também é pontuada, mas só como informação.
_Avoid_: checklist, critérios

**Juiz**:
Um modelo Claude único, de versão fixa anotada, chamado direto pela API fora de qualquer harness, que pontua a rubrica em todas as rodadas sem saber de qual harness veio o registro, que a bancada anonimiza. Cada rodada é pontuada 3 vezes e vale a mediana. Roda como etapa separada, que pode ser refeita sem repetir a rodada; o risco de viés de afinidade consta no relatório.
_Avoid_: avaliador, revisor

**Fatos capturados**:
O que a bancada registra por conta própria durante a rodada. A base, igual para todos os harnesses, é observada de fora: arquivos criados ou alterados, comandos executados e tempo. Transcrição, tokens e custo entram só quando o harness os expõe, marcados com a origem; quando não existem aparecem como "n/d", nunca estimados.
_Avoid_: logs, telemetria

**Autorrelato**:
O texto curto, em `SELF-REPORT.md`, em que o harness conta o que fez, suas suposições e o que deixou de fora (as três seções fixas: _O que fiz_, _Suposições_, _O que deixei de fora_). É declaração do harness e nunca altera o veredito.
_Avoid_: resumo, relatório do harness

**Divergência**:
Afirmação do autorrelato que contradiz os fatos capturados. Aparece numa seção própria do relatório e pesa na rubrica, não no veredito.
_Avoid_: inconsistência, erro do relatório

**Relatório**:
O documento da rodada montado pela bancada a partir dos fatos capturados, em 8 seções fixas: identificação, veredito, linha do tempo, uso de ferramentas, o que foi entregue, tokens e custo, parecer do juiz, autorrelato com as divergências em relação aos fatos. Sai como `relatorio.md` e `relatorio.json`.
_Avoid_: log, resumo

**Consolidado**:
O relatório que compara as 3 rodadas de cada harness, gerado só dos `relatorio.json` de uma mesma versão da tarefa. Mostra taxa de aprovação, mediana, mínimo e máximo, e uma matriz requisito por harness; declara empate quando a diferença cabe na variação observada, em vez de montar ranking.
_Avoid_: ranking, placar

### Rede social acadêmica

**Discussão**:
Conjunto de comentários de um trabalho científico, organizados por eixo.
_Avoid_: fórum, thread, conversa

**Eixo**:
Aspecto do trabalho a que um comentário se refere, como contribuição, metodologia, resultados ou limitações. Quem comenta escolhe o eixo.
_Avoid_: categoria, tag

**Acompanhar**:
Estado de um pesquisador em relação a um trabalho em que comentou, que reivindicou como autor ou que decidiu seguir. É o que dispara os alertas.
_Avoid_: favoritar, assinar

**Fase por convite**:
Período inicial em que só entram pesquisadores convidados. Termina quando os pesquisadores dessa fase voltam a discutir, que é o critério de sucesso do MVP.
_Avoid_: piloto, beta fechado
