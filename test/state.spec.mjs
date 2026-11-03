// Run with: node --test test/
import test from 'node:test'
import assert from 'node:assert/strict'
import * as S from '../hooks/state.ts'

const seeded = () =>
  S.upsertQuestions(S.emptyState(), {
    topic: 'Reserva',
    questions: [
      { title: 'Quando expira?', ask: 'a', rec: 'r' },
      { id: 'q2', title: 'Quem libera?', ask: 'b', rec: 'r2' },
    ],
  })

test('questions get sequential ids and keep their draft and chat when updated', () => {
  let s = seeded()
  assert.deepEqual(s.questions.map(q => q.id), ['q1', 'q2'])
  s = S.saveDraft(s, 'q1', '  15 min  ')
  s = S.addMessage(s, 'q1', 'claude', 'oi', 1)
  s = S.upsertQuestions(s, { questions: [{ id: 'q1', title: 'Quando expira de fato?' }] })
  assert.equal(s.questions[0].title, 'Quando expira de fato?')
  assert.equal(s.questions[0].draft, '15 min')
  assert.equal(s.questions[0].thread.length, 1)
  assert.equal(s.questions[0].ask, 'a')
})

test('saving an empty draft clears it', () => {
  const s = S.saveDraft(S.saveDraft(seeded(), 'q1', 'x'), 'q1', '   ')
  assert.equal(s.questions[0].draft, '')
})

test('allAnswered counts drafts and sent messages, needs every question and at least one', () => {
  assert.equal(S.allAnswered(S.emptyState()), false)
  let s = S.saveDraft(seeded(), 'q1', 'A')
  assert.equal(S.allAnswered(s), false)
  s = S.sendDrafts(S.saveDraft(s, 'q2', 'B'), 'go', 1)
  assert.equal(S.allAnswered(s), true)
  assert.equal(s.questions.every(q => q.draft === ''), true)
})

test('sending moves every draft into its chat, marks the questions as waiting, and cannot run twice', () => {
  let s = S.saveDraft(S.saveDraft(seeded(), 'q1', 'A'), 'q2', 'B')
  assert.equal(S.draftLines(s), '[q1] Quando expira?\nResposta: A\n\n[q2] Quem libera?\nResposta: B')
  s = S.sendDrafts(s, 'go', 5)
  assert.equal(s.isWritingDocs, true)
  assert.equal(s.command, 'go')
  assert.deepEqual(s.questions.map(q => q.isAwaiting), [true, true])
  assert.deepEqual(s.questions[0].thread, [{ from: 'user', text: 'A', at: 5 }])
  const again = S.saveDraft(s, 'q1', 'C')
  assert.equal(S.sendDrafts(again, 'again', 6), again)
  assert.equal(S.sendDrafts(seeded(), 'go', 1).isWritingDocs, false)
})

const sentTwo = () => S.sendDrafts(S.saveDraft(S.saveDraft(seeded(), 'q1', 'A'), 'q2', 'B'), 'go', 1)
const withDoc = s => S.upsertDocs(s, [{ id: 'g', kind: 'glossary', path: 'CONTEXT.md' }])
const reply = (id, text, extra = {}) => ({ id, reply: text, ...extra })

test('parseRound reads bare JSON, fenced JSON and JSON with prose around it', () => {
  const body = '{"questions":[{"id":"q1","reply":"ok"}],"generalObservation":"x"}'
  for (const text of [body, '```json\n' + body + '\n```', 'Segue:\n' + body + '\nfim'])
    assert.deepEqual(S.parseRound(text)?.questions.map(q => q.reply), ['ok'])
  assert.equal(S.parseRound(body)?.generalObservation, 'x')
  assert.equal(S.parseRound('{"questions":[]}')?.generalObservation, '')
})

test('parseRound refuses anything that is not a round', () => {
  for (const text of ['ok', '', '{"generalObservation":"x"}', '{"questions":"q1"}', '[1]', '{quebrado'])
    assert.equal(S.parseRound(text), undefined)
})

test("Claude's round lands in each question's chat and releases the waiting", () => {
  let s = S.applyRound(sentTwo(), { questions: [reply('q1', 'ok'), reply('q2', 'certo'), reply('nada', 'x')] }, 2)
  assert.deepEqual(s.questions.map(q => q.thread.at(-1).text), ['ok', 'certo'])
  assert.deepEqual(s.questions.map(q => q.isAwaiting), [false, false])
  assert.equal(s.isWritingDocs, false)
  assert.equal(s.questions.length, 2)
})

test('a doubt in the round takes that question from answered back to open; the others stay answered', () => {
  let s = S.applyRound(sentTwo(), { questions: [reply('q1', 'e se?', { open: true }), reply('q2', 'ok')] }, 2)
  assert.deepEqual(s.questions.map(q => q.isOpen), [true, false])
  assert.equal(S.hasAnswered(s.questions[0]), false)
  assert.equal(S.hasAnswered(s.questions[1]), true)
  assert.equal(S.allAnswered(s), false)
  assert.equal(s.phase, 'interview')
  // Answering the doubt closes it again, and sending clears the flag.
  s = S.saveDraft(s, 'q1', 'C')
  assert.equal(S.allAnswered(s), true)
  s = S.sendDrafts(s, 'go', 3)
  assert.equal(s.questions[0].isOpen, false)
  assert.equal(s.isWritingDocs, true)
})

test('new questions arrive in the round as items with a new id, after the existing ones', () => {
  const s = S.applyRound(sentTwo(), { questions: [reply('q1', 'ok'), reply('q2', 'ok'), { id: 'q3', title: 'Nova', ask: 'a', rec: 'r' }] }, 2)
  assert.deepEqual(s.questions.map(q => q.id), ['q1', 'q2', 'q3'])
  assert.deepEqual(s.questions.map(q => q.isOpen), [false, false, false])
  assert.equal(s.isWritingDocs, false)
  assert.equal(S.allAnswered(s), false)
  assert.equal(s.questions[0].thread.length, 2)
  assert.equal(s.questions[2].thread.length, 0)
})

test('an item with a new id and no title is ignored; an existing question can be reworded', () => {
  let s = S.applyRound(seeded(), { questions: [{ id: 'q9', reply: 'solto' }, { id: 'q1', title: 'Quando expira de fato?' }] }, 1)
  assert.equal(s.questions.length, 2)
  assert.equal(s.questions[0].title, 'Quando expira de fato?')
})

test('a general observation is kept on its own, never in a chat', () => {
  let s = S.applyRound(seeded(), { questions: [], generalObservation: '  A reserva muda o checkout inteiro.  ' }, 7)
  assert.deepEqual(s.observations, [{ id: 'o1', text: 'A reserva muda o checkout inteiro.', at: 7 }])
  assert.equal(s.questions.every(q => q.thread.length === 0), true)
  s = S.applyRound(s, { questions: [], generalObservation: '' }, 8)
  assert.equal(s.observations.length, 1)
  s = S.applyRound(s, { questions: [], generalObservation: 'outra' }, 9)
  assert.deepEqual(s.observations.map(o => o.id), ['o1', 'o2'])
})

test('an empty frontier with documents written moves on to the documents; with questions left it does not', () => {
  const written = withDoc(sentTwo())
  assert.equal(written.phase, 'interview')
  assert.equal(S.applyRound(written, { questions: [reply('q1', 'ok'), reply('q2', 'ok')] }, 2).phase, 'documents')
  assert.equal(S.applyRound(written, { questions: [reply('q1', 'ok'), { id: 'q3', title: 'N', ask: 'a', rec: 'r' }] }, 2).phase, 'interview')
  assert.equal(S.applyRound(sentTwo(), { questions: [reply('q1', 'ok')] }, 2).phase, 'interview')
})

test('a doubt or a new question after the documents began reopens the interview', () => {
  const docs = S.applyRound(withDoc(sentTwo()), { questions: [] }, 2)
  assert.equal(docs.phase, 'documents')
  const doubt = S.applyRound(docs, { questions: [reply('q1', 'e se?', { open: true })] }, 3)
  assert.equal(doubt.phase, 'interview')
  assert.equal(doubt.questions[0].isOpen, true)
  assert.equal(doubt.docs.length, 1)
  assert.equal(S.applyRound(docs, { questions: [{ id: 'q3', title: 'N', ask: 'a', rec: 'r' }] }, 3).phase, 'interview')
})

test('a reply to a document id lands in the document chat and changes no phase', () => {
  const docs = S.applyRound(withDoc(sentTwo()), { questions: [] }, 2)
  const s = S.applyRound(docs, { questions: [reply('g', 'ajustado')] }, 3)
  assert.equal(s.docs[0].thread.at(-1).text, 'ajustado')
  assert.equal(s.phase, 'documents')
})

test('registering a document does not end the interview; a glossary names the language file', () => {
  const s = S.upsertDocs(sentTwo(), [{ id: 'g', kind: 'glossary', path: 'GLOSSARY.md' }])
  assert.equal(s.phase, 'interview')
  assert.equal(s.isWritingDocs, true)
  assert.equal(s.contextFile, 'GLOSSARY.md')
  assert.equal(S.finish(S.applyRound(s, { questions: [] }, 2)).phase, 'done')
})

test('updating a question never leaves the documents; a new one reopens the interview', () => {
  const s = S.applyRound(withDoc(sentTwo()), { questions: [] }, 2)
  assert.equal(S.upsertQuestions(s, { questions: [{ id: 'q1', title: 'x' }] }).phase, 'documents')
  const more = S.upsertQuestions(s, { questions: [{ title: 'Nova', ask: 'a', rec: 'r' }] })
  assert.equal(more.phase, 'interview')
  assert.equal(more.questions.at(-1).id, 'q3')
})

test('an old state file keeps its answers: a draft while the interview is open, a sent message after', () => {
  const old = id => ({ id, title: 't', decision: '15 min' })
  const open = S.normalize({ ...seeded(), questions: [old('q1')] })
  assert.equal(open.questions[0].draft, '15 min')
  assert.deepEqual(open.questions[0].thread, [])
  const sent = S.normalize({ ...seeded(), phase: 'documents', questions: [old('q1')] })
  assert.equal(sent.questions[0].draft, '')
  assert.equal(sent.questions[0].thread[0].text, '15 min')
  assert.equal(S.normalize(seeded()).questions[0].draft, '')
})

test('saving an approved document again sends it back to review, unless only its status changed', () => {
  let s = S.upsertDocs(S.emptyState(), [{ id: 'adr-1', kind: 'adr', path: 'docs/adr/0001-x.md', label: 'ADR 0001' }])
  s = S.setApproved(s, 'adr-1', true)
  assert.equal(S.upsertDocs(s, [{ id: 'adr-1', kind: 'adr', path: 'docs/adr/0001-x.md' }]).docs[0].isApproved, false)
  assert.equal(S.upsertDocs(s, [{ id: 'adr-1', kind: 'adr', path: 'docs/adr/0001-x.md', keepApproved: true }]).docs[0].isApproved, true)
})

test('a person message on a document withdraws its approval; Claude\'s does not', () => {
  let s = S.upsertDocs(S.emptyState(), [{ id: 'g', kind: 'glossary', path: 'CONTEXT.md' }])
  s = S.setApproved(s, 'g', true)
  assert.equal(S.addMessage(s, 'g', 'claude', 'ok', 1).docs[0].isApproved, true)
  s = S.addMessage(s, 'g', 'user', 'ajuste', 1)
  assert.equal(s.docs[0].isApproved, false)
})

const withOptions = () =>
  S.upsertQuestions(S.emptyState(), {
    questions: [
      { id: 'q1', title: 'Quando expira?', ask: 'a', rec: 'porque sim', recommended: 'b', options: [{ label: '15 min', detail: 'curto' }, { label: '1 h' }, { label: '' }] },
      { id: 'q2', title: 'Aberta', ask: 'b', rec: 'r2', recommended: 'A' },
    ],
  })

test('options are lettered by position; blanks are dropped and the recommended letter must name an option', () => {
  const [q1, q2] = withOptions().questions
  assert.deepEqual(q1.options, [{ label: '15 min', detail: 'curto' }, { label: '1 h', detail: '' }])
  assert.equal(q1.recommended, 'B')
  assert.deepEqual([q2.options, q2.recommended], [[], ''])
  assert.equal(S.optionKey(3), 'D')
  assert.equal(S.optionAnswer(q1, 'A'), 'A \u2014 15 min')
  assert.equal(S.optionAnswer(q1, 'C'), '')
  const bad = S.upsertQuestions(withOptions(), { questions: [{ id: 'q1', recommended: 'D' }] })
  assert.equal(bad.questions[0].recommended, '')
  assert.equal(bad.questions[0].options.length, 2)
})

test('picking an option saves it as the draft; a letter with no option changes nothing', () => {
  let s = S.pickOption(withOptions(), 'q1', 'A')
  assert.equal(s.questions[0].draft, 'A \u2014 15 min')
  assert.equal(S.hasAnswered(s.questions[0]), true)
  assert.equal(S.pickOption(s, 'q1', 'Z'), s)
  assert.equal(S.pickOption(s, 'q2', 'A'), s)
  assert.equal(S.draftLines(s), '[q1] Quando expira?\nResposta: A \u2014 15 min')
})

test('the recommendation answer is the recommended option, else the recommendation text', () => {
  const [q1, q2] = withOptions().questions
  assert.equal(S.recAnswer(q1), 'B \u2014 1 h')
  assert.equal(S.recAnswer(q2), 'r2')
})

test('options come in the round, reword an existing question, and survive a reply without them', () => {
  const body = JSON.stringify({ questions: [{ id: 'q3', title: 'N', ask: 'a', rec: 'r', recommended: 'A', options: [{ label: 'Sim' }, { label: 'N\u00e3o' }] }] })
  const round = S.parseRound(body)
  assert.deepEqual(round.questions[0].options, [{ label: 'Sim' }, { label: 'N\u00e3o' }])
  let s = S.applyRound(withOptions(), round, 1)
  assert.deepEqual(s.questions[2].options.map(o => o.label), ['Sim', 'N\u00e3o'])
  assert.equal(s.questions[2].recommended, 'A')
  s = S.applyRound(s, { questions: [{ id: 'q1', reply: 'ok' }] }, 2)
  assert.equal(s.questions[0].options.length, 2)
  s = S.applyRound(s, { questions: [{ id: 'q1', options: [{ label: 'x' }, { label: 'y' }, { label: 'z' }], recommended: 'C' }] }, 3)
  assert.deepEqual(s.questions[0].options.map(o => o.label), ['x', 'y', 'z'])
  assert.equal(s.questions[0].recommended, 'C')
})

test('an old state file without options still loads', () => {
  const old = { ...S.emptyState(), questions: [{ id: 'q1', title: 't', draft: '', thread: [] }] }
  const q = S.normalize(old).questions[0]
  assert.deepEqual([q.options, q.recommended], [[], ''])
})

test('a reply can carry alternatives, a recommendation and a reference, like a question', () => {
  const reply = { id: 'q1', reply: 'Confirma uma destas?', open: true, options: [{ label: 'A + C' }, { label: 'S\u00f3 C' }, { label: '' }], recommended: 'a', rec: 'porque sim', refFile: 'x.md' }
  const s = S.applyRound(withOptions(), { questions: [reply] }, 1)
  const [q] = s.questions
  const msg = q.thread[0]
  assert.deepEqual(msg.options.map(o => o.label), ['A + C', 'S\u00f3 C'])
  assert.deepEqual([msg.recommended, msg.rec, msg.refFile], ['A', 'porque sim', 'x.md'])
  // The question itself keeps its own alternatives and recommendation.
  assert.deepEqual([q.options.length, q.recommended, q.rec], [2, 'B', 'porque sim'])
})

test('a click answers the alternatives of Claude\'s last message, else the question\'s', () => {
  let s = S.applyRound(withOptions(), { questions: [{ id: 'q1', reply: 'e agora?', options: [{ label: 'X' }, { label: 'Y' }], recommended: 'B' }] }, 1)
  assert.equal(S.pickOption(s, 'q1', 'B').questions[0].draft, 'B \u2014 Y')
  assert.equal(S.recAnswer(s.questions[0]), 'B \u2014 Y')
  s = S.applyRound(s, { questions: [{ id: 'q1', reply: 'sem alternativas' }] }, 2)
  assert.equal(S.pickOption(s, 'q1', 'A').questions[0].draft, 'A \u2014 15 min')
})
