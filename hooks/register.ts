import type { EngineInterface, Register } from 'claude-code'

import * as S from './state'

type Api = EngineInterface

const COMMAND = 'grill-me-mod'
const SKILL = 'grill-me-mod:grill-with-docs-web'
const TAG = '[grill-me-mod]'
// Approvals arrive one click at a time; Claude hears them as one batch.
const NOTE_DELAY_MS = 2500
// The start prompt waits for the command to finish before it asks for a turn.
const START_DELAY_MS = 300

type Server = { port: number; token: string; url: string; root: string; state: string }

let server: Server | undefined
let booting: Promise<Server> | undefined
let queue: Promise<unknown> = Promise.resolve()
let notes: string[] = []
// Every prompt this mod sends asks for a round (JSON). Until one arrives the
// answer is owed; a turn that ends without a valid round is asked again, twice at most.
let owed = false
let retries = 0
const MAX_RETRIES = 2
// The interview ended and Claude has not proposed what to write: ask again, twice at most.
let planAsks = 0
const ROUND_RULE =
  'Responda SOMENTE com o JSON da rodada ({ "questions": [...], "generalObservation": "..." }), sem texto fora do JSON, como manda a skill.'
let noteTimer: { cancel: () => void } | undefined

// One folder per session: two sessions in the same project must not share (or
// wipe) each other's interview.
// The root is pinned when the command runs: the session's cwd moves whenever
// Claude changes directory, and the server keeps reading the original file.
let pinned: { id: string; root: string; state: string } | undefined

const paths = async ($: Api, pin = false) => {
  const id = String(await $.session.id()).replace(/[^\w-]/g, '_')
  if (!pin && pinned?.id === id) return pinned
  const root = await $.session.cwd()
  const found = { id, root, state: `${root}/.grill-me/${id}/state.json` }
  if (pin) pinned = found
  return found
}

const load = async ($: Api): Promise<S.State> => {
  const { state } = await paths($)
  try {
    return S.normalize({ ...S.emptyState(), ...JSON.parse(await $.fs.read(state)) })
  } catch {
    return S.emptyState()
  }
}

/** Every change goes through here, one at a time: this mod is the file's only writer. */
const mutate = ($: Api, fn: (s: S.State) => S.State): Promise<S.State> => {
  const run = queue.then(async () => {
    const { state } = await paths($)
    const before = await load($)
    const after = {
      ...fn(before),
      rev: before.rev + 1,
      updatedAt: await $.clock.now(),
    }
    await $.fs.write(state, JSON.stringify(after, null, 2))
    return after
  })
  queue = run.catch(() => undefined)
  return run
}

const tell = ($: Api, text: string, isRetry = false) => {
  owed = true
  if (!isRetry) retries = 0
  // A refused or dropped prompt resolves instead of throwing: say so, never swallow it.
  $.prompt.submit({ text: `${TAG} ${text}` }).then(
    r => {
      if (r.drop) $.ui.log(`${TAG} prompt dropped: ${r.drop}`, { to: 'debug' })
    },
    err => $.ui.log(`${TAG} prompt failed: ${String(err)}`, { to: 'debug' }),
  )
}

const tellSoon = ($: Api, line: string) => {
  notes.push(line)
  noteTimer?.cancel()
  noteTimer = $.clock.after(NOTE_DELAY_MS, () => {
    const batch = notes
    notes = []
    tell($, `${batch.join('\n')}\n\n${ROUND_RULE}`)
  })
}

// ---- what the person does on the page ----

type Action = {
  action: string
  id?: string
  text?: string
  key?: string
  command?: string
}

const apply = async ($: Api, a: Action) => {
  const now = await $.clock.now()
  const id = a.id ?? ''
  const text = (a.text ?? '').trim()

  switch (a.action) {
    // Answers are only saved. Claude hears them together, when the person sends.
    case 'save':
      await mutate($, s => S.saveDraft(s, id, text))
      return
    case 'useRec':
      await mutate($, s => {
        const q = s.questions.find(x => x.id === id)
        return q ? S.saveDraft(s, id, S.recAnswer(q)) : s
      })
      return
    case 'pick':
      await mutate($, s => S.pickOption(s, id, a.key ?? ''))
      return
    case 'message': {
      if (!text) return
      const s = await mutate($, s => (s.docs.some(d => d.id === id) ? S.addMessage(s, id, 'user', text, now) : s))
      const d = s.docs.find(x => x.id === id)
      if (!d) return
      tell(
        $,
        `Pedido do usuário sobre o documento ${d.path}:\n\n> ${text.replaceAll('\n', '\n> ')}\n\n` +
          `Se for um ajuste, edite o arquivo, registre de novo com grill_docs (o documento volta para revisão) e explique o que mudou no JSON da rodada ` +
          `(questions: [{ "id": "${id}", "reply": "..." }]). Se for uma pergunta, só responda do mesmo jeito. ${ROUND_RULE}`,
      )
      return
    }
    case 'submit': {
      const command = (a.command ?? '').trim()
      let sent = ''
      let count = 0
      let didSend = false
      const s = await mutate($, s => {
        count = S.pendingDrafts(s).length
        sent = S.draftLines(s)
        const next = S.sendDrafts(s, command || s.command, now)
        didSend = next !== s
        return next
      })
      if (!didSend) return
      tell(
        $,
        `O usuário enviou ${count} resposta(s), todas de uma vez:\n\n${sent}\n\n` +
          (s.command ? `Instrução dele para esta rodada: "${s.command}"\n\n` : '') +
          `Continue a entrevista (skill ${SKILL}): atualize ${s.contextFile} na hora com os termos resolvidos (e registre com grill_docs), ` +
          `escreva uma ADR só se o usuário aceitou uma oferta sua, recalcule a fronteira e devolva a próxima rodada. ` +
          `Para cada resposta, um item em questions com o id dela e o seu retorno em reply; marque open: true onde o retorno for uma dúvida ou contrapergunta. ` +
          `Perguntas novas entram como itens com id novo. questions vazio quer dizer fronteira vazia. ${ROUND_RULE}`,
      )
      return
    }
    // The selection step: nothing is written until the person confirms it.
    case 'setTerm':
      await mutate($, s => S.setTerm(s, id, a.key === 'on'))
      return
    case 'termsAll':
      await mutate($, s => S.selectAllTerms(s, a.key === 'on'))
      return
    case 'addTerm':
      await mutate($, s => S.addTerm(s, text))
      return
    case 'setAdr':
      await mutate($, s => S.setAdr(s, id, a.key === 'on'))
      return
    case 'confirmAllAdrs':
      await mutate($, S.confirmAllAdrs)
      return
    case 'setExtra':
      await mutate($, s => S.setExtra(s, id, a.key === 'on'))
      return
    case 'createDocs': {
      const command = (a.command ?? '').trim()
      let started = false
      const s = await mutate($, s => {
        const next = S.startDocs(s, command || s.command)
        started = next !== s
        return next
      })
      if (!started) return
      tell(
        $,
        `O usuário confirmou a seleção. Escreva agora estes documentos, e só eles:\n\n${S.planLines(s)}\n\n` +
          (s.command ? `Instrução dele: "${s.command}"\n\n` : '') +
          `Siga a seção "Escrever os documentos" da skill ${SKILL}. Registre cada arquivo com grill_docs no mesmo turno em que o escrever. ` +
          `Devolva questions vazio e, em generalObservation, uma linha por documento criado. ${ROUND_RULE}`,
      )
      return
    }
    case 'approve': {
      const s = await mutate($, s => S.setApproved(s, id, true))
      const d = s.docs.find(x => x.id === id)
      if (d?.kind === 'adr') {
        tellSoon($, `O usuário aprovou ${d.path}. Troque o status do ADR para accepted no arquivo e registre de novo com grill_docs (keepApproved: true). Devolva questions vazio, sem generalObservation.`)
      }
      return
    }
    case 'unapprove':
      await mutate($, s => S.setApproved(s, id, false))
      return
    case 'finish':
      await mutate($, S.finish)
      tell($, `O usuário concluiu os documentos. Encerre com questions vazio e, em generalObservation, um resumo de 3 linhas do que foi criado. ${ROUND_RULE}`)
      return
  }
}

// ---- the local server and its line-by-line report ----

const ensureServer = ($: Api, root: string, statePath: string): Promise<Server> => {
  if (server) return Promise.resolve(server)
  // Two runs in a row share one boot: never two servers for one session.
  booting ??= boot($, root, statePath).finally(() => {
    booting = undefined
  })
  return booting
}

const boot = ($: Api, root: string, statePath: string): Promise<Server> =>
  new Promise((resolve, reject) => {
    const token = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    void (async () => {
      let buffer = ''
      try {
        const child = $.process.spawn({
          argv: ['node', `${$.plugin.root}/app/server.mjs`, '--root', root, '--state', statePath, '--token', token],
          cwd: root,
        })
        for await (const piece of child) {
          if (piece.stream === 'stderr') {
            $.ui.log(piece.text, { to: 'debug' })
            continue
          }
          buffer += piece.text
          let at = buffer.indexOf('\n')
          while (at >= 0) {
            const line = buffer.slice(0, at).trim()
            buffer = buffer.slice(at + 1)
            at = buffer.indexOf('\n')
            if (!line) continue
            try {
              const msg = JSON.parse(line)
              if (msg.type === 'ready') {
                const url = `http://127.0.0.1:${msg.port}/?t=${token}`
                server = { port: msg.port, token, url, root, state: statePath }
                resolve(server)
              } else if (msg.type === 'action') {
                void apply($, msg).catch(err => $.ui.log(`action failed: ${String(err)}`, { to: 'debug' }))
              }
            } catch {
              $.ui.log(line, { to: 'debug' })
            }
          }
        }
      } catch (err) {
        reject(err)
      } finally {
        server = undefined
        reject(new Error('the grill-me-mod server stopped'))
      }
    })()
  })

const openPage = async ($: Api, url: string) => {
  const opener = (await $.process.run(['sh', '-c', 'command -v xdg-open || command -v open'])).stdout.trim()
  if (opener) void $.process.run([opener, url]).catch(() => undefined)
}

// ---- the tools Claude speaks through ----

const text = { type: 'string' }

const TOOLS = [
  {
    name: 'grill_docs',
    description:
      'Registra na página os documentos que você escreveu ou alterou (glossário, ADRs, TDD, PRD, BRD, RFC, runbook), ao mesmo tempo em que os escreve, depois que o usuário confirmou a seleção. Não é a sua resposta: a resposta é sempre o JSON da rodada. Salvar de novo um documento aprovado devolve-o para revisão. A página lê o arquivo do disco para a pré-visualização.',
    inputSchema: {
      type: 'object',
      properties: {
        docs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { ...text, description: 'Estável, ex.: glossario, adr-0014.' },
              kind: { type: 'string', enum: ['glossary', 'adr', ...S.EXTRA_TYPES] },
              label: { ...text, description: 'Ex.: "Linguagem ubíqua" ou "ADR 0014".' },
              path: { ...text, description: 'Caminho relativo à raiz do projeto.' },
              summary: { ...text, description: 'Ex.: "3 termos novos · 1 alterado" ou "Novo · status Proposto".' },
              keepApproved: { type: 'boolean', description: 'true só quando a edição foi apenas trocar o status da ADR depois da aprovação: o documento segue aprovado.' },
              terms: {
                type: 'array',
                description: 'Só para o glossário: todos os termos que mudaram nesta entrevista até agora (a lista inteira, não só os da rodada).',
                items: {
                  type: 'object',
                  properties: {
                    name: text,
                    tag: { type: 'string', enum: ['Novo', 'Alterado'] },
                    def: text,
                    avoid: text,
                    was: { ...text, description: 'Definição anterior, quando Alterado.' },
                  },
                  required: ['name', 'tag', 'def'],
                },
              },
            },
            required: ['kind', 'path'],
          },
        },
      },
      required: ['docs'],
    },
  },
  {
    name: 'grill_plan',
    description:
      'Registra na página a proposta do que escrever depois da entrevista: os termos candidatos do glossário, os títulos das ADRs e quais documentos adicionais fazem sentido. Chame quando a fronteira esvaziar, antes de responder com questions vazio. Não escreve arquivo nenhum: o usuário escolhe na página. Chamar de novo substitui a proposta e preserva as escolhas dele.',
    inputSchema: {
      type: 'object',
      properties: {
        note: { ...text, description: 'O entendimento compartilhado, em poucas linhas.' },
        terms: {
          type: 'array',
          description: 'Conceitos que devem entrar na linguagem ubíqua (só os que são novos ou mudaram).',
          items: {
            type: 'object',
            properties: {
              name: text,
              tag: { type: 'string', enum: ['Novo', 'Alterado'] },
              def: { ...text, description: 'Definição de uma ou duas frases.' },
              avoid: { ...text, description: 'Sinônimos rejeitados.' },
            },
            required: ['name', 'def'],
          },
        },
        adrs: {
          type: 'array',
          description: 'Uma ADR por decisão da entrevista. Sempre ao menos uma.',
          items: {
            type: 'object',
            properties: { title: { ...text, description: 'Título curto da decisão.' }, why: { ...text, description: 'Uma frase: o que foi decidido e por quê.' } },
            required: ['title'],
          },
        },
        extras: {
          type: 'array',
          description: 'Um item por tipo, com a sua sugestão.',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: S.EXTRA_TYPES },
              suggested: { type: 'boolean', description: 'true quando o documento faz sentido para o que foi decidido.' },
              reason: { ...text, description: 'Uma frase: por que sim ou por que não.' },
            },
            required: ['type', 'suggested'],
          },
        },
      },
      required: ['adrs', 'extras'],
    },
  },
  {
    name: 'grill_state',
    description: 'Lê o estado atual da sessão (perguntas com chat e rascunhos, observações gerais, documentos). Use depois de uma compactação ou se perder o fio.',
    inputSchema: { type: 'object', properties: {} },
  },
] as const

const answer = (result: string) => ({ result })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const tool of TOOLS) await $.tool.register({ ...tool, isDeferred: false } as never)
    await $.command.register({
      name: COMMAND,
      description: 'Entrevista grill-with-docs numa página web, com um chat por pergunta e revisão dos documentos',
      argumentHint: '[tema]',
    })
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const { root, state: statePath } = await paths($, true)
    const topic = e.args.trim()

    try {
      await ensureServer($, root, statePath)
    } catch (err) {
      return { text: `${COMMAND}: não consegui subir o servidor local (${String(err)}). É preciso ter o node no PATH.` }
    }
    // A server already running keeps its own file: stay on it even if the cwd moved.
    if (pinned && server) pinned = { ...pinned, root: server.root, state: server.state }

    // Every run starts clean: nothing from an earlier interview carries over.
    noteTimer?.cancel()
    notes = []
    owed = false
    retries = 0
    planAsks = 0
    await $.fs.write(`${server!.root}/.grill-me/.gitignore`, '*\n')
    await mutate($, () => ({ ...S.emptyState(), topic }))
    await openPage($, server!.url)

    const brief =
      `Invoque a skill ${SKILL} (ferramenta Skill) para conduzir a entrevista de grill-with-docs. Responda SEMPRE com o JSON da rodada (questions e generalObservation), como manda a skill.` +
      (topic
        ? ` Tema: ${topic}.`
        : ' Sem tema informado: deduza do contexto da conversa e do repositório, e só pergunte no terminal se não houver como deduzir.') +
      ' A página já está aberta; fale com o usuário por ela.'
    // Submitted from inside the running command the prompt never became a turn.
    // Let the command finish first; the context below is the fallback if it still doesn't.
    $.clock.after(START_DELAY_MS, () => tell($, brief))
    return { text: `${COMMAND}: página em ${server!.url}`, context: [`${TAG} ${brief}`] }
  }).catch(() => ({ text: `${COMMAND}: falhou ao abrir a sessão; veja o log de debug (claude --debug).` }))

  // The round: every turn this mod asked for ends with the JSON object of the skill.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer' || !server) return out
    const round = S.parseRound(e.answer)
    if (!round) {
      if (owed && retries < MAX_RETRIES) {
        retries++
        tell($, `A sua resposta não era o JSON da rodada. ${ROUND_RULE} Refaça, com o mesmo conteúdo.`, true)
      }
      return out
    }
    owed = false
    retries = 0
    const now = await $.clock.now()
    const after = await mutate($, s => S.applyRound(s, round, now)).catch(err => {
      $.ui.log(`round failed: ${String(err)}`, { to: 'debug' })
      return undefined
    })
    // The frontier is empty but the selection was never proposed: ask for it.
    if (after && S.needsPlan(after) && planAsks < MAX_RETRIES) {
      planAsks++
      tell(
        $,
        `A entrevista acabou, mas o plano de documentos não foi registrado. Chame grill_plan agora (termos do glossário, títulos das ADRs e sugestão dos documentos adicionais), ` +
          `como manda a seção "A seleção dos documentos" da skill ${SKILL}. Não escreva nenhum arquivo ainda. ${ROUND_RULE}`,
      )
    }
    return out
  })

  for (const tool of TOOLS) {
    on('tool.call', { tool: `mcp__${'grill-me-mod'}__${tool.name}` }, async ($, e) => {
      const input = e as unknown as Record<string, any>
      switch (tool.name) {
        case 'grill_docs':
          await mutate($, s => S.upsertDocs(s, input.docs ?? []))
          return answer('Documentos registrados na página. Continue: a sua resposta é o JSON da rodada.')
        case 'grill_plan': {
          const after = await mutate($, s => S.setPlan(s, input as S.PlanInput))
          planAsks = 0
          if (!after.plan || (after.phase !== 'interview' && after.phase !== 'plan')) return answer('O plano só pode ser registrado antes de os documentos começarem. Ignorado.')
          if (after.plan.adrs.length === 0) return answer('Plano registrado, mas sem nenhuma ADR. Toda entrevista gera ao menos uma ADR: chame grill_plan de novo com os títulos.')
          return answer('Plano registrado na página. Não escreva nenhum arquivo ainda: a sua resposta é o JSON da rodada, com questions vazio.')
        }
        case 'grill_state':
          return answer(JSON.stringify(await load($), null, 2))
      }
    }).catch(() => ({ deny: `${tool.name}: não consegui atualizar a página do grill-me-mod.` }))
  }
}
