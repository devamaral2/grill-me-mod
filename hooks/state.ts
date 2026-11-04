// The session's state: one JSON file the page reads and this mod alone writes.
// Every function here is pure, so register.ts can queue them and tests can
// replay them.

/** One alternative of a question. Its letter (A, B, C…) is its position, never written by Claude. */
export type Option = { label: string; detail: string }

/**
 * A message in a chat. A reply of Claude's can carry what a question carries
 * (alternatives, a recommendation, a reference), so the page draws it as the same card.
 */
export type Msg = {
  from: 'user' | 'claude'
  text: string
  at: number
  options?: Option[]
  recommended?: string
  rec?: string
  refFile?: string
  refText?: string
}

export type Question = {
  id: string
  short: string
  title: string
  ask: string
  refFile: string
  refText: string
  rec: string
  /** The alternatives the person can pick with one click; empty for an open question. */
  options: Option[]
  /** Letter of the recommended option; empty when none is, or when it names no option. */
  recommended: string
  /** What the person saved and has not sent yet; Claude only hears it on send. */
  draft: string
  /** Sent in the last batch and not answered yet. */
  isAwaiting: boolean
  /** Claude's return raised a doubt: the question is open again until the person answers. */
  isOpen: boolean
  /** The chat: what was sent and what Claude returned. */
  thread: Msg[]
}

export type DocTerm = {
  name: string
  tag: 'Novo' | 'Alterado'
  def: string
  avoid: string
  was: string
}

/** The extra documents the person can ask for besides the glossary and the ADRs. */
export type ExtraType = 'tdd' | 'prd' | 'brd' | 'rfc' | 'runbook'

export const EXTRA_TYPES: ExtraType[] = ['tdd', 'prd', 'brd', 'rfc', 'runbook']

/** What each extra document is, in the words the page shows. `skill` holds its format, loaded only when it is written. */
export const EXTRAS: Record<ExtraType, { label: string; what: string; skill: string }> = {
  tdd: {
    label: 'TDD · Technical Design Document',
    what: 'Como a solução será construída: arquitetura, componentes, dados, interfaces, riscos e plano de testes.',
    skill: 'grill-me-mod:doc-tdd',
  },
  prd: {
    label: 'PRD · Product Requirements Document',
    what: 'O que construir e para quem: problema, usuários, requisitos, métricas de sucesso e o que fica de fora.',
    skill: 'grill-me-mod:doc-prd',
  },
  brd: {
    label: 'BRD · Business Requirements Document',
    what: 'Por que o negócio precisa disto: objetivos, regras de negócio, stakeholders, impacto e critérios de aceite.',
    skill: 'grill-me-mod:doc-brd',
  },
  rfc: {
    label: 'RFC · Request for Comments',
    what: 'Proposta técnica aberta a revisão: alternativas, trade-offs e o feedback que se quer antes de decidir.',
    skill: 'grill-me-mod:doc-rfc',
  },
  runbook: {
    label: 'Runbook',
    what: 'Passo a passo operacional: como operar, monitorar, diagnosticar e reverter em produção.',
    skill: 'grill-me-mod:doc-runbook',
  },
}

/** A concept that may enter the glossary. Chosen like a tag: on by default, off with a click. */
export type PlanTerm = {
  id: string
  name: string
  tag: 'Novo' | 'Alterado'
  def: string
  avoid: string
  isSelected: boolean
  /** Added by the person: Claude writes the definition when it writes the glossary. */
  isCustom: boolean
}

/** A decision that becomes an ADR. It is only written once the person confirms its title. */
export type PlanAdr = { id: string; title: string; why: string; isConfirmed: boolean }

export type PlanExtra = {
  type: ExtraType
  label: string
  what: string
  /** Claude's call: this document makes sense for what the interview settled. */
  isSuggested: boolean
  reason: string
  isSelected: boolean
}

/** What Claude proposes to write after the interview, and what the person kept. */
export type Plan = {
  /** The shared understanding, in a few lines. */
  note: string
  terms: PlanTerm[]
  adrs: PlanAdr[]
  extras: PlanExtra[]
}

export type DocKind = 'glossary' | 'adr' | ExtraType

export type Doc = {
  id: string
  kind: DocKind
  label: string
  path: string
  summary: string
  isApproved: boolean
  terms: DocTerm[]
  thread: Msg[]
}

/** A remark of Claude's that belongs to no question in particular. */
export type Observation = { id: string; text: string; at: number }

export type Phase = 'interview' | 'plan' | 'documents' | 'done'

export type State = {
  rev: number
  topic: string
  phase: Phase
  contextFile: string
  questions: Question[]
  command: string
  /** The selection step between the interview and the documents; null until Claude proposes it. */
  plan: Plan | null
  docs: Doc[]
  observations: Observation[]
  isWritingDocs: boolean
  updatedAt: number
}

export const emptyState = (): State => ({
  rev: 0,
  topic: '',
  phase: 'interview',
  contextFile: 'CONTEXT.md',
  questions: [],
  command: '',
  plan: null,
  docs: [],
  observations: [],
  isWritingDocs: false,
  updatedAt: 0,
})

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback

export type QuestionInput = {
  id?: string
  short?: string
  title?: string
  ask?: string
  refFile?: string
  refText?: string
  rec?: string
  options?: { label?: string; detail?: string }[]
  recommended?: string
}

const MAX_OPTIONS = 8

/** A, B, C… by position. */
export const optionKey = (i: number): string => String.fromCharCode(65 + i)

const cleanOptions = (raw: unknown): Option[] =>
  Array.isArray(raw)
    ? raw
        .map(o => (typeof o === 'string' ? { label: o } : o))
        .filter((o): o is { label?: unknown; detail?: unknown } => typeof o === 'object' && o !== null)
        .map(o => ({ label: str(o.label).trim(), detail: str(o.detail).trim() }))
        .filter(o => o.label !== '')
        .slice(0, MAX_OPTIONS)
    : []

/** The letter if it names one of the options, else ''. */
const cleanRecommended = (raw: unknown, options: Option[]): string => {
  const key = str(raw).trim().slice(0, 1).toUpperCase()
  return key !== '' && options.some((_, i) => optionKey(i) === key) ? key : ''
}

/**
 * The alternatives a click answers now: the ones on Claude's last message when
 * it carries any, else the question's own.
 */
export const liveChoices = (q: Question): { options: Option[]; recommended: string } => {
  const last = q.thread[q.thread.length - 1]
  return last && last.from === 'claude' && last.options?.length
    ? { options: last.options, recommended: last.recommended ?? '' }
    : { options: q.options, recommended: q.recommended }
}

/** What picking option `key` saves as the answer: "B — label". Empty when there is no such option. */
export const optionAnswer = (q: Question, key: string): string => {
  const { options } = liveChoices(q)
  const i = options.findIndex((_, at) => optionKey(at) === key)
  return i >= 0 ? `${key} — ${options[i].label}` : ''
}

/** The answer "use the recommendation" saves: the recommended option, else the recommendation text. */
export const recAnswer = (q: Question): string => {
  const { recommended } = liveChoices(q)
  return (recommended ? optionAnswer(q, recommended) : '') || q.rec
}

export const upsertQuestions = (
  s: State,
  input: { topic?: string; contextFile?: string; questions?: QuestionInput[] },
): State => {
  const questions = s.questions.map(q => ({ ...q }))
  let isNewRound = false
  for (const raw of input.questions ?? []) {
    const id = str(raw.id) || `q${questions.length + 1}`
    const at = questions.findIndex(q => q.id === id)
    const base: Question =
      at >= 0
        ? questions[at]
        : {
            id,
            short: '',
            title: '',
            ask: '',
            refFile: '',
            refText: '',
            rec: '',
            options: [],
            recommended: '',
            draft: '',
            isAwaiting: false,
            isOpen: false,
            thread: [],
          }
    const options = raw.options === undefined ? base.options : cleanOptions(raw.options)
    const next: Question = {
      ...base,
      options,
      recommended: cleanRecommended(raw.recommended ?? base.recommended, options),
      short: str(raw.short, base.short) || base.title.slice(0, 28),
      title: str(raw.title, base.title),
      ask: str(raw.ask, base.ask),
      refFile: str(raw.refFile, base.refFile),
      refText: str(raw.refText, base.refText),
      rec: str(raw.rec, base.rec),
    }
    if (at >= 0) questions[at] = next
    else {
      questions.push(next)
      isNewRound = true
    }
  }
  return {
    ...s,
    // New questions after the documents began: the interview is open again.
    phase: isNewRound && s.phase !== 'interview' ? 'interview' : s.phase,
    isWritingDocs: isNewRound ? false : s.isWritingDocs,
    topic: str(input.topic, s.topic),
    contextFile: str(input.contextFile, s.contextFile) || 'CONTEXT.md',
    questions,
  }
}

const mapQuestion = (
  s: State,
  id: string,
  fn: (q: Question) => Question,
): State => ({
  ...s,
  questions: s.questions.map(q => (q.id === id ? fn(q) : q)),
})

const mapDoc = (s: State, id: string, fn: (d: Doc) => Doc): State => ({
  ...s,
  docs: s.docs.map(d => (d.id === id ? fn(d) : d)),
})

const isQuestion = (s: State, id: string): boolean => s.questions.some(q => q.id === id)

/** A question or a document: the two things that have a chat. */
export const hasChat = (s: State, id: string): boolean =>
  isQuestion(s, id) || s.docs.some(d => d.id === id)

/** Saves what the person answered; an empty text clears it. Nothing is sent to Claude. */
export const saveDraft = (s: State, id: string, text: string): State =>
  mapQuestion(s, id, q => ({ ...q, draft: text.trim() }))

/** Saves the click on an option as the answer. A key that names no option changes nothing. */
export const pickOption = (s: State, id: string, key: string): State => {
  const q = s.questions.find(x => x.id === id)
  const text = q ? optionAnswer(q, key) : ''
  return text ? saveDraft(s, id, text) : s
}

/** A doubt from Claude takes a sent answer back to open; a new saved draft answers it again. */
export const hasAnswered = (q: Question): boolean =>
  q.draft !== '' || (!q.isOpen && q.thread.some(m => m.from === 'user'))

export const allAnswered = (s: State): boolean =>
  s.questions.length > 0 && s.questions.every(hasAnswered)

/** What the next send carries: every saved draft. */
export const pendingDrafts = (s: State) =>
  s.questions.filter(q => q.draft !== '').map(q => ({ id: q.id, title: q.short || q.title, text: q.draft }))

export const draftLines = (s: State): string =>
  pendingDrafts(s)
    .map(d => `[${d.id}] ${d.title}\nResposta: ${d.text.replaceAll('\n', '\n   ')}`)
    .join('\n\n')

/**
 * Sends every draft at once: each becomes a message in its question's chat and
 * the question waits for Claude's return. Nothing to send, or a send already
 * under way, changes nothing.
 */
export const sendDrafts = (s: State, command: string, at: number): State => {
  if (s.isWritingDocs || pendingDrafts(s).length === 0) return s
  return {
    ...s,
    command,
    isWritingDocs: true,
    questions: s.questions.map(q =>
      q.draft === ''
        ? q
        : { ...q, draft: '', isAwaiting: true, isOpen: false, thread: [...q.thread, { from: 'user', text: q.draft, at }] },
    ),
  }
}

/**
 * Adds a message to a question's or a document's own chat. A person's message
 * on a document withdraws the approval it argues with, so the page never shows
 * approved a text the conversation has moved past.
 */
export const addMessage = (
  s: State,
  id: string,
  from: Msg['from'],
  text: string,
  at: number,
  extra: Partial<Omit<Msg, 'from' | 'text' | 'at'>> = {},
): State => {
  const msg: Msg = { from, text, at, ...extra }
  if (isQuestion(s, id)) return mapQuestion(s, id, q => ({ ...q, thread: [...q.thread, msg] }))
  return mapDoc(s, id, d => ({
    ...d,
    thread: [...d.thread, msg],
    isApproved: from === 'user' ? false : d.isApproved,
  }))
}

/**
 * One item of a round. An id that already has a chat (a question or a document)
 * gets `reply` appended to it; `open` makes that reply a doubt, so the question
 * is open again until the person answers. An id with no chat is a new question
 * and needs at least a title. Fields given for an existing question update it.
 */
export type RoundItem = QuestionInput & {
  reply?: string
  /** The reply is a doubt or a counter-question: the question goes back to open. */
  open?: boolean
}

/** What Claude's turn must end with: always this JSON object, nothing else. */
export type Round = {
  questions: RoundItem[]
  /** A remark that belongs to no question in particular; absent when there is none. */
  generalObservation?: string
}

const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i

/**
 * Reads a round from the text of a turn's answer: the bare JSON object, the same
 * inside a code fence, or an object found between the first `{` and the last
 * `}`. Anything else (an ordinary answer, malformed JSON, the wrong shape) is
 * not a round.
 */
export const parseRound = (text: string): Round | undefined => {
  const trimmed = text.trim()
  const candidates = [trimmed, fenced.exec(trimmed)?.[1] ?? '']
  const from = trimmed.indexOf('{')
  const to = trimmed.lastIndexOf('}')
  if (from >= 0 && to > from) candidates.push(trimmed.slice(from, to + 1))
  for (const c of candidates) {
    if (!c) continue
    let json: unknown
    try {
      json = JSON.parse(c)
    } catch {
      continue
    }
    if (typeof json !== 'object' || json === null || Array.isArray(json)) continue
    const raw = json as Record<string, unknown>
    if (!Array.isArray(raw.questions)) continue
    const questions: RoundItem[] = raw.questions
      .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null && !Array.isArray(q))
      .map(q => ({
        id: str(q.id),
        short: str(q.short),
        title: str(q.title),
        ask: str(q.ask),
        refFile: str(q.refFile),
        refText: str(q.refText),
        rec: str(q.rec),
        options: Array.isArray(q.options) ? (q.options as RoundItem['options']) : undefined,
        recommended: str(q.recommended),
        reply: str(q.reply),
        open: q.open === true,
      }))
    return { questions, generalObservation: str(raw.generalObservation).trim() }
  }
  return undefined
}

/** What a reply carries beyond its text: the pieces that make its card look like a question. */
const replyCard = (item: RoundItem): Partial<Msg> => {
  const options = cleanOptions(item.options)
  const card: Partial<Msg> = {}
  if (options.length) {
    card.options = options
    const recommended = cleanRecommended(item.recommended, options)
    if (recommended) card.recommended = recommended
  }
  for (const k of ['rec', 'refFile', 'refText'] as const) {
    const v = str(item[k]).trim()
    if (v) card[k] = v
  }
  return card
}

/**
 * Applies Claude's round to the session. Each reply lands in the chat of its
 * question or document and releases the waiting; new questions are added after
 * the existing ones; a general observation is kept on its own. When something
 * is left for the person (a doubt or a new question) the interview is open
 * again. When nothing is, the frontier is empty: the interview is over and the
 * documents, if any were written, are the next step.
 */
export const applyRound = (s: State, round: Round, at: number): State => {
  let next = s
  const reopened = new Set<string>()
  const created: QuestionInput[] = []
  const edited: QuestionInput[] = []
  for (const item of round.questions) {
    const id = str(item.id)
    const reply = str(item.reply).trim()
    if (id && hasChat(next, id)) {
      if (reply) next = addMessage(next, id, 'claude', reply, at, replyCard(item))
      if (item.open === true && isQuestion(next, id)) reopened.add(id)
      // With a reply, the alternatives, recommendation and reference belong to the reply's card, not to the question.
      const rewords = reply ? item.title || item.ask || item.short : item.title || item.ask || item.rec || item.short || item.options?.length
      if (isQuestion(next, id) && rewords) edited.push(reply ? { ...item, rec: undefined, options: undefined, recommended: undefined, refFile: undefined, refText: undefined } : item)
    } else if (str(item.title)) {
      created.push(item)
    }
  }
  const answered = round.questions.filter(r => isQuestion(next, str(r.id)) && str(r.reply).trim()).map(r => str(r.id))
  next = {
    ...next,
    questions: next.questions.map(q => ({
      ...q,
      isAwaiting: false,
      isOpen: reopened.has(q.id) || (q.isOpen && !answered.includes(q.id)),
    })),
  }
  if (edited.length > 0 || created.length > 0) next = upsertQuestions(next, { questions: [...edited, ...created] })
  const remark = str(round.generalObservation).trim()
  if (remark) next = { ...next, observations: [...next.observations, { id: `o${next.observations.length + 1}`, text: remark, at }] }

  const hasPending = reopened.size > 0 || created.length > 0 || next.questions.some(q => q.isOpen)
  // The frontier is empty: the selection step comes next, once Claude has proposed it.
  // Documents written without a plan (an older run) go straight to review.
  const phase: Phase = hasPending
    ? 'interview'
    : next.phase === 'interview' && next.plan
      ? 'plan'
      : next.phase === 'interview' && next.docs.length > 0
        ? 'documents'
        : next.phase
  return { ...next, phase, isWritingDocs: false }
}

const isExtra = (v: unknown): v is ExtraType => EXTRA_TYPES.includes(v as ExtraType)

const docKind = (raw: unknown): DocKind => (raw === 'glossary' ? 'glossary' : isExtra(raw) ? raw : 'adr')

const defaultLabel = (kind: DocKind): string =>
  kind === 'glossary' ? 'Linguagem ubíqua' : kind === 'adr' ? 'ADR' : EXTRAS[kind].label.split(' · ')[0]

export type DocInput = {
  id?: string
  kind?: string
  label?: string
  path?: string
  summary?: string
  /** A status-only edit after approval: the document stays approved. */
  keepApproved?: boolean
  terms?: {
    name?: string
    tag?: string
    def?: string
    avoid?: string
    was?: string
  }[]
}

/**
 * Registers the documents Claude wrote, by id. A document saved again after it
 * was approved goes back to review: its text is not what the person approved.
 */
export const upsertDocs = (s: State, docs: DocInput[]): State => {
  const list = s.docs.map(d => ({ ...d }))
  for (const raw of docs) {
    const path = str(raw.path)
    const id = str(raw.id) || path
    const kind = docKind(raw.kind)
    const at = list.findIndex(d => d.id === id)
    const base: Doc =
      at >= 0
        ? list[at]
        : {
            id,
            kind,
            label: '',
            path,
            summary: '',
            isApproved: false,
            terms: [],
            thread: [],
          }
    const next: Doc = {
      ...base,
      kind,
      label: str(raw.label, base.label) || defaultLabel(kind),
      path: path || base.path,
      summary: str(raw.summary, base.summary),
      isApproved: raw.keepApproved === true && base.isApproved,
      terms:
        raw.terms === undefined
          ? base.terms
          : raw.terms.map(t => ({
              name: str(t.name),
              tag: t.tag === 'Alterado' ? 'Alterado' : 'Novo',
              def: str(t.def),
              avoid: str(t.avoid),
              was: str(t.was),
            })),
    }
    if (at >= 0) list[at] = next
    else list.push(next)
  }
  const glossary = list.find(d => d.kind === 'glossary' && d.path)
  return { ...s, docs: list, contextFile: glossary?.path ?? s.contextFile }
}

export const setApproved = (s: State, id: string, isApproved: boolean): State =>
  mapDoc(s, id, d => ({ ...d, isApproved }))

export const finish = (s: State): State => ({ ...s, phase: 'done' })

// ---- the selection step: what gets written, chosen before anything is ----

const slug = (t: string): string =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export type PlanInput = {
  note?: string
  terms?: { name?: string; tag?: string; def?: string; avoid?: string }[]
  adrs?: { title?: string; why?: string }[]
  extras?: { type?: string; suggested?: boolean; reason?: string }[]
}

/** `base`, or `base-2`, `base-3`… when it is taken; the result is marked taken. */
const uniqueId = (base: string, taken: Set<string>): string => {
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  taken.add(id)
  return id
}

/**
 * Registers Claude's proposal, replacing the earlier one. What the person
 * already decided on an entry that comes back (same term, same ADR title, same
 * document type) is kept, and so are the terms the person added. All five extra
 * documents are always listed: the ones Claude does not suggest start off.
 */
export const setPlan = (s: State, input: PlanInput): State => {
  if (s.phase !== 'interview' && s.phase !== 'plan') return s
  const before = s.plan
  const termIds = new Set<string>()
  const terms: PlanTerm[] = []
  for (const raw of input.terms ?? []) {
    const name = str(raw.name).trim()
    if (!name) continue
    const base = slug(name) || 'termo'
    if (termIds.has(base)) continue
    const id = uniqueId(base, termIds)
    terms.push({
      id,
      name,
      tag: raw.tag === 'Alterado' ? 'Alterado' : 'Novo',
      def: str(raw.def).trim(),
      avoid: str(raw.avoid).trim(),
      isSelected: before?.terms.find(t => t.id === id)?.isSelected ?? true,
      isCustom: false,
    })
  }
  for (const t of before?.terms ?? []) if (t.isCustom && !termIds.has(t.id)) terms.push(t)

  const adrIds = new Set<string>()
  const adrs: PlanAdr[] = []
  for (const raw of input.adrs ?? []) {
    const title = str(raw.title).trim()
    if (!title) continue
    const id = uniqueId(slug(title) || `adr-${adrs.length + 1}`, adrIds)
    adrs.push({ id, title, why: str(raw.why).trim(), isConfirmed: before?.adrs.find(a => a.id === id)?.isConfirmed ?? false })
  }

  const extras: PlanExtra[] = EXTRA_TYPES.map(type => {
    const given = (input.extras ?? []).find(e => e.type === type)
    const isSuggested = given?.suggested === true
    const kept = before?.extras.find(e => e.type === type)
    return {
      type,
      label: EXTRAS[type].label,
      what: EXTRAS[type].what,
      isSuggested,
      reason: str(given?.reason).trim(),
      isSelected: kept ? kept.isSelected : isSuggested,
    }
  })

  return { ...s, plan: { note: str(input.note, before?.note ?? '').trim(), terms, adrs, extras } }
}

/**
 * The interview is over, every question answered, and Claude has not proposed
 * what to write: the mod must ask for it.
 */
export const needsPlan = (s: State): boolean =>
  s.phase === 'interview' &&
  s.plan === null &&
  s.docs.length === 0 &&
  s.questions.length > 0 &&
  s.questions.every(q => !q.isOpen && !q.isAwaiting && q.draft === '' && q.thread.some(m => m.from === 'user'))

const mapPlan = (s: State, fn: (p: Plan) => Plan): State =>
  s.phase === 'plan' && s.plan ? { ...s, plan: fn(s.plan) } : s

// Every choice carries its value, never "flip": the page shows the change before the mod
// has applied it, and a flip applied twice would leave the two out of step.
export const setTerm = (s: State, id: string, isSelected: boolean): State =>
  mapPlan(s, p => ({ ...p, terms: p.terms.map(t => (t.id === id ? { ...t, isSelected } : t)) }))

export const selectAllTerms = (s: State, isSelected: boolean): State =>
  mapPlan(s, p => ({ ...p, terms: p.terms.map(t => ({ ...t, isSelected })) }))

/** A concept the person wants in the glossary that Claude left out. A name already listed is just selected. */
export const addTerm = (s: State, name: string): State => {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!clean) return s
  const id = slug(clean) || 'termo'
  return mapPlan(s, p =>
    p.terms.some(t => t.id === id)
      ? { ...p, terms: p.terms.map(t => (t.id === id ? { ...t, isSelected: true } : t)) }
      : { ...p, terms: [...p.terms, { id, name: clean, tag: 'Novo', def: '', avoid: '', isSelected: true, isCustom: true }] },
  )
}

export const setAdr = (s: State, id: string, isConfirmed: boolean): State =>
  mapPlan(s, p => ({ ...p, adrs: p.adrs.map(a => (a.id === id ? { ...a, isConfirmed } : a)) }))

export const confirmAllAdrs = (s: State): State =>
  mapPlan(s, p => ({ ...p, adrs: p.adrs.map(a => ({ ...a, isConfirmed: true })) }))

export const setExtra = (s: State, type: string, isSelected: boolean): State =>
  mapPlan(s, p => ({ ...p, extras: p.extras.map(e => (e.type === type ? { ...e, isSelected } : e)) }))

/** ADRs are never skipped: the documents start once every one of them is confirmed. */
export const planReady = (s: State): boolean =>
  s.phase === 'plan' && s.plan !== null && s.plan.adrs.every(a => a.isConfirmed)

/** The person confirmed the selection: Claude writes it now. Nothing changes while an ADR is unconfirmed. */
export const startDocs = (s: State, command: string): State =>
  planReady(s) ? { ...s, phase: 'documents', isWritingDocs: true, command } : s

/** What Claude is told to write, from the selection. */
export const planLines = (s: State): string => {
  const p = s.plan
  if (!p) return ''
  const picked = p.terms.filter(t => t.isSelected)
  const dropped = p.terms.filter(t => !t.isSelected)
  const term = (t: PlanTerm) =>
    `- ${t.name} (${t.tag})${t.def ? `: ${t.def}` : t.isCustom ? ': definição a escrever por você, a pedido do usuário' : ''}${t.avoid ? ` | Evitar: ${t.avoid}` : ''}`
  const extras = p.extras.filter(e => e.isSelected)
  return [
    `Glossário (${s.contextFile}), só estes termos:`,
    picked.length ? picked.map(term).join('\n') : '- nenhum: não altere o arquivo',
    dropped.length ? `Termos descartados pelo usuário (não escreva): ${dropped.map(t => t.name).join(', ')}` : '',
    '',
    'ADRs confirmadas, uma por arquivo em docs/adr/:',
    p.adrs.length ? p.adrs.map(a => `- ${a.title}`).join('\n') : '- nenhuma',
    '',
    'Documentos adicionais escolhidos:',
    extras.length
      ? extras.map(e => `- ${e.label}: invoque a skill ${EXTRAS[e.type].skill} antes de escrever`).join('\n')
      : '- nenhum',
  ]
    .filter((l, i, all) => l !== '' || all[i - 1] !== '')
    .join('\n')
}

/** A plan from the file: every list present, the five extra documents always there. */
const normalizePlan = (p: Plan | null | undefined): Plan | null => {
  if (!p || typeof p !== 'object') return null
  return {
    note: str(p.note),
    terms: Array.isArray(p.terms) ? p.terms : [],
    adrs: Array.isArray(p.adrs) ? p.adrs : [],
    extras: EXTRA_TYPES.map(type => {
      const kept = Array.isArray(p.extras) ? p.extras.find(e => e?.type === type) : undefined
      return {
        type,
        label: EXTRAS[type].label,
        what: EXTRAS[type].what,
        isSuggested: kept?.isSuggested === true,
        reason: str(kept?.reason),
        isSelected: kept?.isSelected === true,
      }
    }),
  }
}

/**
 * A state file written before drafts and chats: a saved answer or a decision
 * is still a draft while the interview is open, and already a sent message
 * once the documents began. Missing chat fields get their defaults.
 */
export const normalize = (s: State): State => ({
  ...s,
  plan: normalizePlan(s.plan),
  observations: Array.isArray(s.observations) ? s.observations : [],
  questions: s.questions.map(q => {
    const old = q as Question & { answer?: unknown; decision?: unknown }
    const thread = Array.isArray(q.thread) ? q.thread : []
    const options = cleanOptions(q.options)
    const kept = { options, recommended: cleanRecommended(q.recommended, options) }
    if (typeof q.draft === 'string') return { ...q, ...kept, isAwaiting: q.isAwaiting === true, isOpen: q.isOpen === true, thread }
    const legacy = typeof old.answer === 'string' ? old.answer : typeof old.decision === 'string' ? old.decision : ''
    const isSent = legacy !== '' && s.phase !== 'interview' && !thread.some(m => m.from === 'user')
    return {
      ...q,
      ...kept,
      draft: isSent ? '' : legacy,
      isAwaiting: false,
      isOpen: false,
      thread: isSent ? [...thread, { from: 'user' as const, text: legacy, at: 0 }] : thread,
    }
  }),
})
