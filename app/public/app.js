// grill-me-mod page. No build step, no dependencies: state comes from
// /api/state, people's actions go to /api/action, and Claude answers through
// the mod's grill_* tools, which change the state this page polls.
(() => {
  'use strict'

  const params = new URLSearchParams(location.search)
  let token = params.get('t') || ''
  try {
    if (token) sessionStorage.setItem('grill-token', token)
    else token = sessionStorage.getItem('grill-token') || ''
  } catch {}
  if (params.has('t')) history.replaceState(null, '', location.pathname + location.hash)

  const app = document.getElementById('app')
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  let state = null
  let rev = -1
  let misses = 0
  const ui = {
    drafts: {}, // text typed and not sent, by composer key
    outbox: [], // document messages sent and not yet seen in the state
    saved: {}, // drafts saved and not yet seen in the state, by question id
    editing: {}, // questions whose saved answer is being rewritten
    files: {}, // document previews by path
    command: null,
    openFull: false,
    toast: '',
    counts: {}, // thread length last drawn, by key
    view: null, // what the page showed last: { key, order }
    nextNav: '', // how the next move should look, when the order of the tabs would say otherwise
    answered: null, // ids of the answered questions last drawn
    pending: null, // alternative highlighted by a letter key and waiting for Enter: { id, key }
  }

  // ---------- text ----------

  const esc = s =>
    String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

  const inline = raw => {
    const codes = []
    let s = esc(raw).replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c)
      return `\u0000${codes.length - 1}\u0000`
    })
    s = s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`)
  }

  const md = src => {
    const lines = String(src ?? '').replace(/\r/g, '').split('\n')
    const out = []
    const isBlock = l => /^(#{1,4}\s|```|>\s?|\s*[-*]\s+|\s*\d+\.\s+|---+\s*$)/.test(l)
    for (let i = 0; i < lines.length; ) {
      const ln = lines[i]
      let m
      if (!ln.trim()) { i++; continue }
      if (/^```/.test(ln)) {
        const code = []
        for (i++; i < lines.length && !/^```/.test(lines[i]); i++) code.push(lines[i])
        i++
        out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
      } else if ((m = ln.match(/^(#{1,4})\s+(.*)$/))) {
        const level = Math.min(m[1].length, 3)
        out.push(`<h${level}>${inline(m[2])}</h${level}>`)
        i++
      } else if (/^---+\s*$/.test(ln)) {
        out.push('<hr>')
        i++
      } else if (/^>\s?/.test(ln)) {
        const q = []
        for (; i < lines.length && /^>\s?/.test(lines[i]); i++) q.push(lines[i].replace(/^>\s?/, ''))
        out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`)
      } else if (/^\s*[-*]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln)) {
        const ordered = /^\s*\d+\./.test(ln)
        const re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/
        const items = []
        for (; i < lines.length && re.test(lines[i]); i++) items.push(`<li>${inline(lines[i].match(re)[1])}</li>`)
        out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`)
      } else {
        const p = []
        for (; i < lines.length && lines[i].trim() && !isBlock(lines[i]); i++) p.push(lines[i])
        out.push(`<p>${inline(p.join(' '))}</p>`)
      }
    }
    return out.join('')
  }

  const frontmatter = src => {
    const m = String(src).match(/^---\n([\s\S]*?)\n---\n?/)
    if (!m) return { meta: {}, body: String(src) }
    const meta = {}
    for (const l of m[1].split('\n')) {
      const kv = l.match(/^(\w[\w-]*):\s*(.*)$/)
      if (kv) meta[kv[1].toLowerCase()] = kv[2].trim()
    }
    return { meta, body: String(src).slice(m[0].length) }
  }

  const STATUS = { proposed: 'Proposto', accepted: 'Aceito', deprecated: 'Obsoleto', rejected: 'Rejeitado' }
  const dateBr = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
    if (!m) return iso || ''
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
    return `${+m[3]} de ${months[+m[2] - 1]} de ${m[1]}`
  }

  // ---------- icons (from the mockups) ----------

  const I = {
    done: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" style="fill:var(--ok)"/><path d="M6 10.3l2.8 2.7L14 7.6" fill="none" style="stroke:var(--on-ok)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    talk: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" style="stroke:var(--accent-ink)" stroke-width="1.5"/><path d="M10 4.5a5.5 5.5 0 0 1 0 11z" style="fill:var(--accent-ink)"/></svg>',
    open: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" style="stroke:var(--open)" stroke-width="1.5"/></svg>',
    list: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5.5h7M4 10h7M4 14.5h5M13.5 12.8l1.7 1.7 3-3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    up: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4.5M5 9.2l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 6.8" fill="none" style="stroke:var(--on-ok)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check16: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.7 3.7L15.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    note: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9.5L6 17v-3.5H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    ext: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4.5H5.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V12M11.5 4.5h4v4M15.5 4.5L9 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  }

  const typing = '<span class="typing" role="status" aria-label="O Claude está respondendo"><i></i><i></i><i></i></span>'

  // ---------- state helpers ----------

  const route = () => {
    const h = location.hash.replace(/^#\/?/, '')
    if (h === 'fim') return { name: 'fim' }
    if (h === 'plano') return { name: 'plano' }
    if (h.startsWith('docs')) return { name: 'docs', id: h.split('/')[1] || '' }
    if (h.startsWith('q/')) return { name: 'q', id: h.slice(2) }
    return { name: 'q', id: '' }
  }

  /** Which view the person is on and where it sits in the flow: questions, then Finalização, then documents. */
  const viewOf = r => {
    const n = state.questions.length
    if (r.name === 'docs') return { key: 'docs', order: n + 2 }
    if (r.name === 'plano') return { key: 'plano', order: n + 1 }
    if (r.name === 'fim') return { key: 'fim', order: n }
    const q = state.questions.find(x => x.id === r.id) || state.questions.find(x => !isAnswered(x)) || state.questions[0]
    return q ? { key: 'q:' + q.id, order: state.questions.indexOf(q) } : null
  }
  /** fwd / back slide sideways; rise is the step out of the questions, into Finalização or the documents. */
  const navKind = (from, to) => {
    if (ui.nextNav) return ui.nextNav
    if (to.order > from.order) return to.key === 'fim' || to.key === 'plano' || to.key === 'docs' ? 'rise' : 'fwd'
    return 'back'
  }

  const userCount = thread => thread.filter(m => m.from === 'user').length

  /** A thread with this page's unsent-to-state messages after it. */
  const threadWith = (key, thread) => {
    ui.outbox = ui.outbox.filter(o => o.key !== key || userCount(thread) <= o.base)
    return thread.concat(ui.outbox.filter(o => o.key === key).map(o => ({ from: 'user', text: o.text })))
  }
  const isWaiting = thread => thread.length > 0 && thread[thread.length - 1].from === 'user'

  /** The saved draft, including one this page saved that the state has not caught up with. */
  const draftOf = q => (q.id in ui.saved ? ui.saved[q.id] : q.draft || '')
  const lastUser = q => [...q.thread].reverse().find(m => m.from === 'user')
  // A doubt from Claude (isOpen) takes a sent answer back to open until the person answers again.
  const isAnswered = q => !!draftOf(q) || (!!lastUser(q) && !q.isOpen)
  const firstUnanswered = () => state.questions.find(q => !isAnswered(q))
  const answeredCount = () => state.questions.filter(isAnswered).length
  const allAnswered = () => state.questions.length > 0 && answeredCount() === state.questions.length
  const draftCount = () => state.questions.filter(draftOf).length
  const qStatus = q => {
    if (draftOf(q)) return 'Salva'
    if (q.isAwaiting) return 'Aguardando o Claude'
    if (q.isOpen) return 'Em aberto · dúvida do Claude'
    const last = q.thread[q.thread.length - 1]
    if (last && last.from === 'claude') return 'Com retorno'
    return lastUser(q) ? 'Enviada' : 'Em aberto'
  }
  const defaultCommand = () => state.command || ''

  // Mirrors optionAnswer/recAnswer in hooks/state.ts: the text a click saves as the answer.
  const optionKey = i => String.fromCharCode(65 + i)
  /** Where a click lands: Claude's last message when it carries alternatives, else the question itself. */
  const liveChoices = q => {
    const last = q.thread[q.thread.length - 1]
    return last && last.from === 'claude' && (last.options || []).length ? last : q
  }
  const optionAnswer = (q, key) => {
    const { options = [] } = liveChoices(q)
    const i = options.findIndex((_, at) => optionKey(at) === key)
    return i >= 0 ? `${key} \u2014 ${options[i].label}` : ''
  }
  const recAnswer = q => {
    const { recommended } = liveChoices(q)
    return (recommended ? optionAnswer(q, recommended) : '') || q.rec
  }
  /** The option the current answer starts with ("B — ..."), if any. */
  const chosenKey = q => {
    const a = draftOf(q) || (q.isOpen ? '' : (lastUser(q) || {}).text || '')
    return (liveChoices(q).options || []).map((_, i) => optionKey(i)).find(k => a.startsWith(`${k} \u2014 `)) || ''
  }

  // ---------- views ----------

  const header = r => {
    const at = r.name === 'docs' ? 3 : r.name === 'plano' ? 2 : 1
    const steps = [
      { n: 1, label: 'Entrevista', href: '#/fim', open: true },
      { n: 2, label: 'Seleção', href: '#/plano', open: !!state.plan && state.phase !== 'interview' },
      { n: 3, label: 'Documentos', href: '#/docs', open: state.phase === 'documents' || state.phase === 'done' || state.docs.length > 0 },
    ]
    const nav = steps
      .map(st => {
        if (st.n === at) return `<div class="step" aria-current="step"><span class="dot">${st.n}</span><span>${st.label}</span></div>`
        if (st.n < at) return `<a class="step link done" href="${st.href}"><span class="dot">${I.check}</span><span>${st.label}</span></a>`
        return st.open
          ? `<a class="step link" href="${st.href}"><span class="dot">${st.n}</span><span>${st.label}</span></a>`
          : `<div class="step"><span class="dot">${st.n}</span><span>${st.label}</span></div>`
      })
      .join('<span class="bar" aria-hidden="true"></span>')
    return `<header class="top">
      <div class="brand"><span class="cmd">/grill-me-mod</span>
        <div style="min-width:0"><div class="topic-label">Tema da entrevista</div>
        <div class="topic" title="${esc(state.topic)}">${esc(state.topic ||(state.questions.length ? 'Entrevista grill-with-docs' : 'O Claude está preparando a entrevista…'))}</div></div></div>
      <div class="top-r"><nav class="steps" aria-label="Etapas do mod">${nav}</nav></div>
    </header>`
  }

  const tabsSide = (r, current) => {
    const total = state.questions.length
    const done = answeredCount()
    const segs = state.questions
      .map(q => `<span class="seg ${isAnswered(q) ? 'ok' : r.name === 'q' && current && current.id === q.id ? 'cur' : ''}" data-id="${esc(q.id)}"></span>`)
      .join('')
    const items = state.questions
      .map(q => {
        const cur = r.name === 'q' && current && current.id === q.id
        const ico = q.isAwaiting ? I.talk : isAnswered(q) ? I.done : I.open
        return `<button type="button" class="tab" data-act="nav" data-to="#/q/${esc(q.id)}" ${cur ? 'aria-current="true"' : ''}>
          <span class="ico">${ico}</span><span class="txt"><span class="name">${esc(q.short || q.title)}</span><span class="sub ${q.isAwaiting && !draftOf(q) ? 'wait' : q.isOpen && !draftOf(q) && !q.isAwaiting ? 'doubt' : ''}">${qStatus(q)}</span></span></button>`
      })
      .join('')
    const pending = total - done
    const finalLabel = state.isWritingDocs ? 'O Claude está trabalhando' : allAnswered() ? (draftCount() ? 'Pronta para enviar' : 'Nada novo para enviar') : total === 0 ? 'Aguardando perguntas' : pending === 1 ? '1 resposta pendente' : `${pending} respostas pendentes`
    const remarks = (state.observations || []).length
    return `<aside class="side" aria-label="Perguntas da entrevista">
      <div class="progress"><div class="progress-row"><span>Progresso</span><span>${done} de ${total} respondidas</span></div><div class="segs">${segs}</div></div>
      <div class="tabs">${items}
      <div class="rule" aria-hidden="true"></div>
      <button type="button" class="tab" data-act="nav" data-to="#/fim" ${r.name === 'fim' ? 'aria-current="true"' : ''}>
        <span class="ico">${I.list}</span><span class="txt"><span class="name">Finalização</span><span class="sub">${finalLabel}${remarks ? ` · ${remarks === 1 ? '1 observação' : `${remarks} observações`}` : ''}</span></span></button></div>
    </aside>`
  }

  // The three blocks of a card, shared by the question and by Claude's replies.
  const refBlock = o =>
    o.refFile || o.refText
      ? `<div class="ref">${o.refFile ? `<code>${esc(o.refFile)}</code>` : ''}${o.refText ? `<span>${esc(o.refText)}</span>` : ''}</div>`
      : ''
  /** `live`: a click on these alternatives answers now; otherwise they are history. */
  const optsBlock = (o, qid, live, chosen, isLocked) => {
    const options = o.options || []
    // A letter key only highlights; Enter confirms it. A click saves at once.
    const pending = live && !isLocked && ui.pending && ui.pending.id === qid && options.some((_, i) => optionKey(i) === ui.pending.key) ? ui.pending.key : ''
    return options.length
      ? `<div class="opts" role="group" aria-label="Alternativas"><div class="who">${live && !isLocked ? `Escolha uma alternativa (teclas ${optionKey(0)}${options.length > 1 ? `–${optionKey(options.length - 1)}` : ''} destacam, Enter confirma) ou escreva outra resposta abaixo` : 'Alternativas oferecidas'}</div>${options
          .map((x, i) => {
            const k = optionKey(i)
            const on = live && (pending ? k === pending : k === chosen)
            return `<button type="button" class="opt${on ? ' on' : ''}${k === pending ? ' pend' : ''}" data-act="pick" data-id="${esc(qid)}" data-key="${k}" aria-pressed="${on}" ${isLocked || !live ? 'disabled' : ''}>
              <span class="k">${k}</span>
              <span class="t"><span class="l">${inline(x.label)}${k === o.recommended ? '<span class="tag">Recomendada</span>' : ''}</span>${x.detail ? `<span class="d">${inline(x.detail)}</span>` : ''}</span>${k === pending ? '<kbd class="enter">Enter para confirmar</kbd>' : ''}</button>`
          })
          .join('')}</div>`
      : ''
  }
  // With alternatives, the recommended one already wears a tag: the block only shows when Claude gave its reasoning.
  const recBlock = (o, text, action) =>
    o.rec
      ? `<div class="rec"><div><div class="who">Resposta recomendada${(o.options || []).length && o.recommended ? ` \u00b7 ${o.recommended}` : ''}</div><div>${inline(o.rec)}</div></div>${action}</div>`
      : ''

  /** The thread of a chat. In a question's chat, Claude's replies are the same card as the question. */
  const bubbles = (thread, q) =>
    thread
      .map((m, i) => {
        if (m.from === 'user') return `<div class="msg-u"><div class="who">Você</div><div class="body-t">${md(m.text)}</div></div>`
        const live = !!q && i === thread.length - 1
        const text = (m.recommended && m.options && m.options[m.recommended.charCodeAt(0) - 65]) ? `${m.recommended} \u2014 ${m.options[m.recommended.charCodeAt(0) - 65].label}` : ''
        return `<section class="card" aria-label="Resposta do Claude"><div class="who">Claude \u00b7 grill-me-mod</div>
          <div class="ask md">${md(m.text)}</div>${refBlock(m)}${q ? optsBlock(m, q.id, live, live ? chosenKey(q) : '', q.isAwaiting) : ''}${recBlock(m, text, '')}</section>`
      })
      .join('')

  const questionView = q => {
    const key = `q:${q.id}`
    const saved = draftOf(q)
    const isEditing = !saved || ui.editing[q.id]
    const draft = key in ui.drafts ? ui.drafts[key] : saved
    const hasChat = q.thread.length > 0
    const ref = refBlock(q)
    const mine = liveChoices(q) === q
    const opts = optsBlock(q, q.id, mine, mine ? chosenKey(q) : '', q.isAwaiting)
    const recText = (q.recommended ? optionAnswer({ ...q, thread: [] }, q.recommended) : '') || q.rec
    const useRec = q.options && q.options.length ? '' : saved === q.rec || hasChat ? '' : '<button type="button" class="btn" data-act="useRec" data-id="' + esc(q.id) + '">Usar esta resposta</button>'
    const rec = recBlock(q, recText, useRec)
    const hint = isEditing
      ? saved
        ? 'Você está reescrevendo o que foi salvo.'
        : hasChat
          ? 'Escreva e salve. Vai para o Claude no próximo envio, na Finalização.'
          : 'Responder só salva. O Claude recebe todas as respostas juntas, quando você enviar na Finalização.'
      : ''
    const bottom = isEditing
      ? `<div class="composer" data-end><div class="strip empty">${hint}</div>
        <div class="compose-in"><label class="sr" for="resposta">Sua resposta para esta pergunta</label>
          <textarea id="resposta" rows="2" data-draft="${esc(key)}" placeholder="${hasChat ? 'Continue a conversa sobre esta pergunta…' : 'Responda, discorde ou peça mais contexto sobre esta pergunta…'}">${esc(draft)}</textarea>
          <div class="compose-foot"><span>Fica salva aqui, sem gastar uma volta com o Claude.</span>
            <span style="display:flex;gap:8px">${saved ? `<button type="button" class="btn plain" data-act="cancelEdit" data-id="${esc(q.id)}">Cancelar</button>` : ''}
            <button type="button" class="btn primary" data-act="save" data-id="${esc(q.id)}" data-send-for="${esc(key)}" ${draft.trim() ? '' : 'disabled'}>Salvar ${I.check16}</button></span></div></div>
      </div>`
      : `<div class="composer" data-end><div class="strip done"><div><div class="who">Salva, ainda não enviada</div><div>${inline(saved)}</div></div>
        <button type="button" class="btn" data-act="edit" data-id="${esc(q.id)}">Editar</button></div></div>`
    return `<div class="col fit">
      <h1>${esc(q.title)}</h1>
      <div class="thread" data-thread role="log" tabindex="0" aria-label="Conversa desta pergunta">
        <section class="card" aria-label="Pergunta do Claude"><div class="who">Claude · grill-me-mod</div>
          <div class="ask md">${md(q.ask)}</div>${ref}${opts}${rec}</section>
        ${bubbles(q.thread, q)}
        ${q.isAwaiting ? `<div class="msg-c"><div class="who">Claude</div>${typing}</div>` : ''}
        ${q.isOpen && !saved && !q.isAwaiting ? '<div class="strip prop"><div><div class="who">Em aberto</div><div>O Claude tem uma dúvida sobre esta resposta. Responda abaixo; vai no próximo envio, na Finalização.</div></div></div>' : ''}
      </div>
      ${!hasChat && !saved ? '<p class="hint">Nenhuma resposta ainda. Responda abaixo ou use a resposta recomendada.</p>' : ''}
      ${bottom}</div>`
  }

  const observationItem = o =>
    `<div class="note">${I.note}<div><div class="who">Observação geral do Claude</div><div class="md">${md(o.text)}</div></div></div>`

  const finalView = () => {
    const total = state.questions.length
    const pending = total - answeredCount()
    const drafts = draftCount()
    const isSent = state.phase !== 'interview'
    const rows = state.questions
      .map((q, i) => {
        const a = draftOf(q) || (lastUser(q) || {}).text || ''
        const status = qStatus(q)
        const ok = !status.startsWith('Em aberto') && status !== 'Salva'
        return `<div class="row"><span class="n">${i + 1}</span>
        <div class="mid"><div class="k">${esc(q.short || q.title)}</div>
          <div class="v ${a ? '' : 'dim'}">${a ? inline(a) : 'Ainda sem resposta. Volte à pergunta para responder.'}</div></div>
        <span class="pill ${ok ? 'ok' : 'warn'}">${esc(status === 'Salva' ? 'Não enviada' : status)}</span>
        <button type="button" class="btn plain" data-act="nav" data-to="#/q/${esc(q.id)}">${a && !q.isOpen ? 'Abrir chat' : 'Responder'}</button></div>`
      })
      .join('')
    const cmd = ui.command !== null ? ui.command : defaultCommand()
    const busy = state.isWritingDocs
    let cta
    if (isSent) cta = `<a class="btn primary" href="${state.phase === 'plan' ? '#/plano' : '#/docs'}">${state.phase === 'plan' ? 'Ir para a seleção' : 'Ir para os documentos'} ${I.right}</a>`
    else if (busy)
      cta = `<div style="display:flex;align-items:center;gap:12px"><span class="note">O Claude está lendo as respostas. Os retornos aparecem no chat de cada pergunta.</span>${typing}</div>`
    else if (!drafts || pending)
      cta = `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px"><span class="note">${
        total === 0 ? 'Ainda não há perguntas.' : pending ? (pending === 1 ? 'Falta 1 pergunta em aberto.' : `Faltam ${pending} perguntas em aberto.`) : 'Nada novo para enviar. Escreva nas abas para uma nova rodada.'
      }</span><button type="button" class="btn" disabled style="padding:0 20px">Enviar ao Claude</button></div>`
    else
      cta = `<button type="button" class="btn primary" data-act="submit" style="padding:0 20px">Enviar ${drafts === 1 ? '1 resposta' : `${drafts} respostas`} ao Claude ${I.right}</button>`
    const remarks = (state.observations || []).map(observationItem).join('')
    return `<div class="col" style="gap:32px">
      ${remarks ? `<section class="section" aria-labelledby="h-obs"><h2 id="h-obs">Observações gerais do Claude</h2><div class="notes">${remarks}</div></section>` : ''}
      <div><h1 style="margin-bottom:8px">Revise as respostas e envie tudo de uma vez</h1>
        <p style="margin:0;max-width:60ch;font-size:16px;line-height:1.6;color:var(--soft-ink)">O que você salvou nas abas só vai para o Claude agora, junto. O retorno dele chega no chat de cada pergunta; perguntas novas viram novas abas e o que não pertence a nenhuma pergunta aparece como observação geral. Nada é escrito no projeto ainda: quando as perguntas acabarem, você escolhe o que entra nos documentos.</p></div>
      <section class="section" aria-labelledby="h-dec"><h2 id="h-dec">Respostas</h2><div class="list">${rows}</div></section>
      <section class="section" aria-labelledby="h-dest"><h2 id="h-dest">O que vem depois</h2><div class="targets">
        <div class="target"><div class="head"><code>${esc(state.contextFile)}</code><span class="tag">Você escolhe</span></div>
          <p>Os conceitos da linguagem ubíqua aparecem como tags: você marca os que entram e acrescenta os que faltam.</p></div>
        <div class="target"><div class="head"><code>docs/adr/</code><span class="tag">Sempre</span></div>
          <p>Uma ADR por decisão da entrevista. Você confirma o título de cada uma antes de ela ser criada.</p></div>
        <div class="target"><div class="head"><code>docs/</code><span class="tag">Opcional</span></div>
          <p>TDD, PRD, BRD, RFC e runbook. O Claude indica os que fazem sentido para o que foi decidido.</p></div></div></section>
      <section class="section" aria-labelledby="h-cmd"><h2 id="h-cmd">Instrução para o Claude</h2>
        <label for="comando">Este texto segue junto com as respostas como instrução para esta rodada. Edite se quiser mudar o foco.</label>
        <div class="cmd-box"><textarea id="comando" rows="3" data-command placeholder="Opcional. Ex.: foque no fluxo de pagamento." ${busy ? 'readonly' : ''}>${esc(cmd)}</textarea>
          <div class="cmd-foot"><button type="button" class="btn plain" data-act="nav" data-to="#/q/${esc((state.questions[0] || {}).id || '')}">Voltar às perguntas</button>${cta}</div></div></section>
    </div>`
  }

  const emptyInterview = () =>
    `<div class="empty-state"><div>${typing}</div><strong>O Claude está montando as perguntas</strong>
      <span>Elas aparecem aqui, uma aba por pergunta, assim que ele publicar a primeira rodada.</span></div>`

  const interviewView = r => {
    const qs = state.questions
    let current = null
    if (r.name === 'q') current = qs.find(q => q.id === r.id) || qs.find(q => !isAnswered(q)) || qs[0] || null
    const main =
      r.name === 'fim' ? finalView() : current ? questionView(current) : emptyInterview()
    return `<div class="body">${tabsSide(r, current)}<main class="main${r.name === 'q' && current ? ' fit' : ''}">${main}</main></div>`
  }

  const termsView = doc =>
    `<div class="terms">${doc.terms
      .map(
        t => `<div class="diff"><div class="add"><span class="sign" aria-hidden="true">+</span><div style="flex:1;min-width:0">
          <div style="display:flex;flex-wrap:wrap;align-items:center"><span class="nm">${esc(t.name)}</span><span class="tg">${esc(t.tag)}</span></div>
          <p>${inline(t.def)}</p>${t.avoid ? `<p class="av">Evitar: ${esc(t.avoid)}</p>` : ''}</div></div>
          ${t.was ? `<div class="del"><span class="sign" aria-hidden="true">−</span><p>${esc(t.was)}</p></div>` : ''}</div>`,
      )
      .join('')}</div>`

  const articleView = doc => {
    const file = ui.files[doc.path]
    if (doc.kind === 'glossary' && doc.terms.length) {
      const full = file && file.exists
        ? `<details class="full" id="full" ${ui.openFull ? 'open' : ''}><summary>Ver o arquivo completo</summary><div class="md" style="margin-top:12px">${md(frontmatter(file.content).body)}</div></details>`
        : ''
      return `<div class="inner"><div><h1>Linguagem ubíqua</h1><p class="sub">Mostrando só o que mudou nesta entrevista.</p></div>${termsView(doc)}${full}</div>`
    }
    if (!file) return '<p class="hint">Carregando o arquivo…</p>'
    if (!file.exists) return `<p class="hint">O arquivo <code class="mono">${esc(doc.path)}</code> ainda não existe no disco.</p>`
    const { meta, body } = frontmatter(file.content)
    const chips = [
      meta.status ? `<span class="pill">Status: ${esc(STATUS[meta.status.toLowerCase()] || meta.status)}</span>` : '',
      meta.date ? `<span>${esc(dateBr(meta.date))}</span>` : '',
    ].join('')
    return `<div class="inner narrow md"><div>${chips ? `<div class="meta">${chips}</div>` : ''}${md(body)}</div></div>`
  }

  // ---------- selection ----------

  const tick = on => `<span class="tick${on ? ' on' : ''}" aria-hidden="true">${on ? I.check16 : ''}</span>`

  const termChip = (t, locked) =>
    `<button type="button" class="term${t.isSelected ? ' on' : ''}" data-act="setTerm" data-id="${esc(t.id)}" data-key="${t.isSelected ? 'off' : 'on'}" aria-pressed="${t.isSelected}" ${locked ? 'disabled' : ''}>
      <span class="term-top">${tick(t.isSelected)}<span class="nm">${esc(t.name)}</span><span class="tg${t.tag === 'Alterado' ? ' changed' : ''}">${esc(t.isCustom ? 'Seu' : t.tag)}</span></span>
      <span class="df">${t.def ? inline(t.def) : '<em>O Claude escreve a definição.</em>'}</span>${t.avoid ? `<span class="av">Evitar: ${esc(t.avoid)}</span>` : ''}</button>`

  const adrRow = (a, locked) =>
    `<div class="row"><div class="mid"><div class="k">ADR</div><div class="v">${esc(a.title)}</div>${a.why ? `<div class="why">${inline(a.why)}</div>` : ''}</div>
      <span class="pill ${a.isConfirmed ? 'ok' : 'warn'}">${a.isConfirmed ? 'Confirmada' : 'Aguardando'}</span>
      ${a.isConfirmed
        ? `<button type="button" class="btn plain" data-act="setAdr" data-id="${esc(a.id)}" data-key="off" ${locked ? 'disabled' : ''}>Desfazer</button>`
        : `<button type="button" class="btn primary" data-act="setAdr" data-id="${esc(a.id)}" data-key="on" ${locked ? 'disabled' : ''}>Confirmar criação ${I.check16}</button>`}</div>`

  const extraRow = (e, locked) =>
    `<button type="button" class="row xrow${e.isSelected ? ' on' : ''}" data-act="setExtra" data-id="${esc(e.type)}" data-key="${e.isSelected ? 'off' : 'on'}" aria-pressed="${e.isSelected}" ${locked ? 'disabled' : ''}>
      ${tick(e.isSelected)}
      <span class="mid"><span class="v">${esc(e.label)}</span><span class="what">${esc(e.what)}</span>${e.reason ? `<span class="why">${inline(e.reason)}</span>` : ''}</span>
      <span class="pill ${e.isSuggested ? 'ok' : ''}">${e.isSuggested ? 'Sugerido' : 'Opcional'}</span></button>`

  const planView = () => {
    const p = state.plan
    const locked = state.phase !== 'plan'
    const terms = p.terms.filter(t => t.isSelected).length
    const adrsOk = p.adrs.filter(a => a.isConfirmed).length
    const extras = p.extras.filter(e => e.isSelected).length
    const ready = !locked && p.adrs.every(a => a.isConfirmed)
    const missing = p.adrs.length - adrsOk
    const draft = ui.drafts.term || ''
    const side = `<aside class="side docs" aria-label="Resumo da seleção">
      <div style="padding:0 12px 12px"><div class="serif" style="font-size:20px;font-weight:500;line-height:1.3">O que será criado</div>
        <div style="margin-top:2px;font-size:13px;color:var(--soft-ink)">Nada é escrito antes de você confirmar.</div></div>
      <div class="tabs">
        <div class="sumrow"><span>Linguagem ubíqua</span><b>${terms} de ${p.terms.length} conceitos</b></div>
        <div class="sumrow"><span>ADRs</span><b>${adrsOk} de ${p.adrs.length} confirmadas</b></div>
        <div class="sumrow"><span>Documentos adicionais</span><b>${extras === 0 ? 'nenhum' : extras === 1 ? '1 escolhido' : `${extras} escolhidos`}</b></div></div>
      <div class="side-foot"><button type="button" class="btn primary ${ready ? '' : 'off'}" data-act="createDocs" ${ready ? '' : 'disabled'}>${locked ? 'Documentos em andamento' : 'Criar documentos'}</button>
        ${locked ? '' : missing ? `<span class="foot-note">Falta confirmar ${missing === 1 ? '1 ADR' : `${missing} ADRs`}.</span>` : ''}
        <a href="#/fim">Voltar às decisões</a></div></aside>`
    return `<div class="body">${side}<main class="main"><div class="col" style="gap:40px">
      <div><h1 style="margin-bottom:8px">Escolha o que o Claude vai escrever</h1>
        <p class="lead">A entrevista acabou. Antes de qualquer arquivo ser criado, marque os conceitos da linguagem ubíqua, confirme o título de cada ADR e decida quais documentos adicionais valem a pena.</p></div>
      ${locked ? '<div class="strip done" style="border-radius:14px"><div><div class="who">Seleção enviada</div><div>O Claude já está escrevendo. Esta tela fica só para consulta.</div></div></div>' : ''}
      ${p.note ? `<div class="note">${I.note}<div><div class="who">Entendimento compartilhado</div><div class="md">${md(p.note)}</div></div></div>` : ''}

      <section class="section" aria-labelledby="h-terms">
        <div class="sec-head"><div><h2 id="h-terms">Linguagem ubíqua</h2><p class="sub">Cada conceito marcado entra em <code class="mono">${esc(state.contextFile)}</code>. Desmarque o que for detalhe de implementação.</p></div>
          <div class="sec-acts"><button type="button" class="btn plain" data-act="termsAll" data-key="on" ${locked ? 'disabled' : ''}>Marcar todos</button><button type="button" class="btn plain" data-act="termsAll" data-key="off" ${locked ? 'disabled' : ''}>Limpar</button></div></div>
        ${p.terms.length ? `<div class="term-grid">${p.terms.map(t => termChip(t, locked)).join('')}</div>` : '<p class="hint">O Claude não propôs nenhum conceito. Acrescente os que faltam abaixo.</p>'}
        <form class="add-term" data-add-term>
          <label class="sr" for="novo-termo">Acrescentar um conceito à linguagem ubíqua</label>
          <input id="novo-termo" type="text" maxlength="80" autocomplete="off" data-draft="term" placeholder="Acrescentar outro conceito…" value="${esc(draft)}" ${locked ? 'disabled' : ''}>
          <button type="submit" class="btn" data-send-for="term" ${draft.trim() && !locked ? '' : 'disabled'}>Acrescentar</button></form>
      </section>

      <section class="section" aria-labelledby="h-adrs">
        <div class="sec-head"><div><h2 id="h-adrs">ADRs</h2><p class="sub">Toda decisão da entrevista vira uma ADR. Ela só é criada depois que você confirma o título.</p></div>
          <div class="sec-acts"><button type="button" class="btn plain" data-act="confirmAllAdrs" ${locked || !missing ? 'disabled' : ''}>Confirmar todas</button></div></div>
        <div class="list">${p.adrs.map(a => adrRow(a, locked)).join('') || '<div class="row"><span class="hint">O Claude ainda não propôs nenhuma ADR.</span></div>'}</div>
      </section>

      <section class="section" aria-labelledby="h-extras">
        <div class="sec-head"><div><h2 id="h-extras">Documentos adicionais</h2><p class="sub">Opcionais. O Claude marcou como sugeridos os que fazem sentido para o que foi decidido; você decide.</p></div></div>
        <div class="list">${p.extras.map(e => extraRow(e, locked)).join('')}</div>
      </section>
    </div></main></div>`
  }

  const docsView = r => {
    const docs = state.docs
    const total = docs.length
    const approved = docs.filter(d => d.isApproved).length
    const doc = docs.find(d => d.id === r.id) || docs[0]
    const isDone = state.phase === 'done'
    const all = total > 0 && approved === total
    const items = docs
      .map(
        d => `<button type="button" class="doc-tab" data-act="nav" data-to="#/docs/${esc(d.id)}" ${doc && d.id === doc.id ? 'aria-current="true"' : ''}>
          <span class="top-r"><span class="kind">${esc(d.label)}</span><span class="pill ${d.isApproved ? 'ok' : 'warn'}">${d.isApproved ? 'Aprovado' : 'Em revisão'}</span></span>
          <span class="path">${esc(d.path)}</span><span class="sum">${esc(d.summary)}</span></button>`,
      )
      .join('')
    const side = `<aside class="side docs" aria-label="Documentos criados">
      <div style="padding:0 12px 12px"><div class="serif" style="font-size:20px;font-weight:500;line-height:1.3">Documentos criados</div>
        <div style="margin-top:2px;font-size:13px;color:var(--soft-ink)">${approved} de ${total} aprovados</div></div>
      <div class="tabs">${items}</div>
      <div class="side-foot"><button type="button" class="btn primary ${all && !isDone ? '' : 'off'}" data-act="finish" ${all && !isDone ? '' : 'disabled'}>${isDone ? 'Sessão concluída' : 'Concluir e fechar'}</button>
        <a href="${state.plan ? '#/plano' : '#/fim'}">${state.plan ? 'Voltar à seleção' : 'Voltar às decisões'}</a></div></aside>`
    if (!doc) {
      return `<div class="body">${side}<main class="main docs"><div class="empty-state"><div>${typing}</div>
        <strong>O Claude está escrevendo os documentos</strong><span>Eles aparecem aqui para revisão assim que forem registrados.</span></div></main></div>`
    }
    const key = `d:${doc.id}`
    const thread = threadWith(key, doc.thread)
    const waiting = isWaiting(thread)
    const draft = ui.drafts[key] || ''
    const approveBtn = doc.isApproved
      ? `<button type="button" class="btn ok" data-act="unapprove" data-id="${esc(doc.id)}">${I.check16} Aprovado · desfazer</button>`
      : `<button type="button" class="btn primary" data-act="approve" data-id="${esc(doc.id)}">Aprovar documento</button>`
    return `<div class="body">${side}
      <main class="main docs">
        ${isDone ? '<div class="strip done" style="border-radius:14px"><div><div class="who">Sessão concluída</div><div>Os documentos estão no projeto. Você pode fechar esta aba.</div></div></div>' : ''}
        <div class="doc-head"><div style="min-width:0"><h1>${esc(doc.label)}</h1><div class="p">${esc(doc.path)}</div></div>
          <div class="acts"><button type="button" class="btn" data-act="openFile" data-path="${esc(doc.path)}">Abrir arquivo para editar ${I.ext}</button>${approveBtn}</div></div>
        <article class="article" aria-label="Pré-visualização do documento">${articleView(doc)}</article>
      </main>
      <section class="chat" aria-label="Chat do documento">
        <div class="chat-head"><div class="t">Ajustes e aprovação</div><div class="p">${esc(doc.path)}</div></div>
        <div class="chat-body">${bubbles(thread)}${waiting ? `<div class="msg-c"><div class="who">Claude</div>${typing}</div>` : ''}
          ${thread.length === 0 ? '<p class="hint">Peça um ajuste a este documento ou aprove.</p>' : ''}</div>
        <div class="chat-in" data-end><div class="composer"><label class="sr" for="ajuste">Pedir um ajuste neste documento</label>
          <textarea id="ajuste" rows="3" data-draft="${esc(key)}" placeholder="Peça um ajuste ou escreva “aprovado”…">${esc(draft)}</textarea>
          <div class="foot"><button type="button" class="btn primary" data-act="send" data-id="${esc(doc.id)}" data-send-for="${esc(key)}" ${draft.trim() ? '' : 'disabled'}>Enviar ${I.up}</button></div></div></div>
      </section></div>`
  }

  // ---------- render ----------

  const threadKey = r => {
    if (r.name === 'docs') {
      const d = state.docs.find(x => x.id === r.id) || state.docs[0]
      return d ? 'd:' + d.id : ''
    }
    if (r.name === 'q') {
      const q = state.questions.find(x => x.id === r.id) || state.questions.find(x => !isAnswered(x)) || state.questions[0]
      return q ? 'q:' + q.id : ''
    }
    return ''
  }

  // ---------- transitions ----------

  // fwd / back slide sideways, the way the person is moving through the tabs; rise is the
  // step out of the questions, into Finalização or the documents.
  const SHIFT = 36
  const MOVES = {
    fwd: { out: { opacity: 0, transform: `translateX(${-SHIFT}px)` }, in: { opacity: 0, transform: `translateX(${SHIFT}px)` } },
    back: { out: { opacity: 0, transform: `translateX(${SHIFT}px)` }, in: { opacity: 0, transform: `translateX(${-SHIFT}px)` } },
    rise: { out: { opacity: 0, transform: 'translateY(-12px) scale(0.99)' }, in: { opacity: 0, transform: 'translateY(20px) scale(0.985)' } },
  }
  const rest = { opacity: 1, transform: 'none' }

  /** The new content arrives a beat after the old one starts leaving. */
  const enter = (el, nav) =>
    el.animate([MOVES[nav].in, rest], { duration: 340, delay: 70, easing: 'cubic-bezier(0.22, 0.8, 0.3, 1)', fill: 'backwards' })

  /** Leaves a copy of `el` where it was, fading out over the new content, then removes it. */
  const leave = (el, nav) => {
    const box = el.getBoundingClientRect()
    const ghost = el.cloneNode(true)
    ghost.removeAttribute('id')
    ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'))
    ghost.setAttribute('aria-hidden', 'true')
    ghost.inert = true
    Object.assign(ghost.style, {
      position: 'fixed', top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px`,
      margin: '0', zIndex: '5', pointerEvents: 'none', overflow: 'hidden',
    })
    document.body.appendChild(ghost)
    ghost.animate([rest, MOVES[nav].out], { duration: 160, easing: 'ease-in', fill: 'forwards' })
    // A timer, not the animation's end: a page that is not painting never finishes one.
    setTimeout(() => ghost.remove(), 260)
  }

  /** A segment of the progress bar that just turned green fills in, left to right. */
  const fillNewSegments = () => {
    const done = new Set(state.questions.filter(isAnswered).map(q => q.id))
    const before = ui.answered
    ui.answered = done
    if (!before || reduceMotion) return
    for (const seg of document.querySelectorAll('.seg.ok')) {
      if (before.has(seg.dataset.id)) continue
      seg.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 420, delay: 180, easing: 'cubic-bezier(0.22, 0.8, 0.3, 1)', fill: 'backwards' })
    }
  }

  /** How far down the page the main column starts: a question is as tall as the window below that. */
  const fitTop = () => {
    const main = app.querySelector('.main.fit')
    if (main) document.documentElement.style.setProperty('--top-h', `${Math.round(main.getBoundingClientRect().top + window.scrollY)}px`)
  }
  window.addEventListener('resize', fitTop)

  let lastHtml = ''
  const render = () => {
    if (!state) {
      app.innerHTML = '<div class="shell"><div class="empty-state" style="margin:80px auto">Conectando ao mod…</div></div>'
      return
    }
    let r = route()
    const planOpen = !!state.plan && state.phase !== 'interview'
    // The selection and the documents only open once the interview is over.
    if ((r.name === 'docs' && (state.phase === 'interview' || state.phase === 'plan')) || (r.name === 'plano' && !planOpen)) {
      location.hash = r.name === 'docs' && planOpen ? '#/plano' : '#/fim'
      return
    }
    if (state.phase !== 'interview' && r.name !== 'docs' && r.name !== 'plano' && !ui.visitedFinal) {
      location.hash = state.phase === 'plan' ? '#/plano' : '#/docs'
      return
    }
    const view = r.name === 'docs' ? docsView(r) : r.name === 'plano' ? planView() : interviewView(r)
    const offline = misses >= 3 ? '<div class="offline" role="alert">Sem conexão com o mod. Rode /grill-me-mod de novo no Claude.</div>' : ''
    const html = `<div class="shell">${offline}${header(r)}${view}${ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : ''}</div>`
    if (html === lastHtml) return
    lastHtml = html

    const at = viewOf(r)
    const moved = !!at && (!ui.view || at.key !== ui.view.key)
    const nav = at && ui.view && at.key !== ui.view.key && !reduceMotion ? navKind(ui.view, at) : ''
    ui.view = at
    ui.nextNav = ''

    const apply = () => {
      const oldThread = app.querySelector('[data-thread]')
      const prevTop = oldThread ? oldThread.scrollTop : 0
      const a = document.activeElement
      const focus = !nav && a && a.id ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null
      const y = window.scrollY
      app.innerHTML = html
      // A new view starts at the top; the same one stays where the person was.
      window.scrollTo(0, nav ? 0 : y)
      if (focus) {
        const el = document.getElementById(focus.id)
        if (el) {
          el.focus({ preventScroll: true })
          if (focus.s != null && el.setSelectionRange) el.setSelectionRange(focus.s, focus.e)
        }
      }
      document.title = state.topic ? `${state.topic} · grill-me-mod` : 'grill-me-mod'
      fitTop()
      // On a phone the tabs are a strip: keep the open one in view.
      if (moved) {
        const cur = app.querySelector('.tabs [aria-current]')
        if (cur && cur.parentElement.scrollWidth > cur.parentElement.clientWidth) cur.scrollIntoView({ inline: 'center', block: 'nearest' })
      }

      // New messages in the open thread: bring the composer back into view.
      const key = threadKey(r)
      if (key) {
        const n = app.querySelectorAll('.msg-u, .msg-c').length
        const grew = ui.counts[key] !== undefined && n > ui.counts[key]
        const thread = app.querySelector('[data-thread]')
        if (thread) {
          // A question opens on Claude's latest comment; the same one stays where the person was
          // scrolled, until something new arrives.
          if (moved || grew || ui.counts[key] === undefined) {
            const claude = [...thread.children].filter(c => c.classList.contains('card'))
            const last = claude[claude.length - 1]
            thread.scrollTo({ top: last ? last.offsetTop : 0, behavior: grew && !moved && !reduceMotion ? 'smooth' : 'auto' })
          } else thread.scrollTop = prevTop
        } else if (grew) {
          const end = document.querySelector('[data-end]')
          if (end) end.scrollIntoView({ block: 'end', behavior: reduceMotion ? 'auto' : 'smooth' })
        }
        ui.counts[key] = n
      }
    }

    if (!nav) {
      apply()
      fillNewSegments()
      return
    }
    // The old content is copied out of the way before the new one is drawn: the swap
    // is immediate and the page never waits on a frame to be usable.
    app.querySelectorAll('.main, .chat').forEach(el => leave(el, nav))
    apply()
    app.querySelectorAll('.main, .chat').forEach(el => enter(el, nav))
    fillNewSegments()
  }

  // ---------- talking to the mod ----------

  const headers = () => ({ 'content-type': 'application/json', 'x-grill-token': token })

  const poll = async () => {
    try {
      const res = await fetch(`/api/state?rev=${rev}`, { headers: headers(), cache: 'no-store' })
      if (res.status === 204) {
        misses = 0
      } else if (res.ok) {
        misses = 0
        const was = state && state.phase
        const wasWriting = !!(state && state.isWritingDocs)
        // The file may not exist yet, or hold less than a full state.
        state = { rev: 0, topic: '', phase: 'interview', contextFile: 'CONTEXT.md', questions: [], command: '', plan: null, docs: [], observations: [], isWritingDocs: false, ...(await res.json()) }
        rev = state.rev
        // The interview is over: the selection comes next (or the documents, for a run without one).
        if (was === 'interview' && state.phase === 'plan') {
          ui.nextNav = 'rise'
          location.hash = '#/plano'
        } else if (was === 'interview' && state.phase === 'documents') location.hash = '#/docs'
        // A new round: Claude's return left a doubt or new questions, so the
        // person goes to the first one still open, wherever they were.
        else if (state.phase === 'interview' && ((was && was !== 'interview') || wasWriting) && !state.isWritingDocs) {
          const next = firstUnanswered()
          if (next && next.id !== route().id) {
            ui.nextNav = 'fwd'
            location.hash = `#/q/${next.id}`
          }
        }
        for (const id of Object.keys(ui.saved)) {
          const q = state.questions.find(x => x.id === id)
          if (!q || (q.draft || '') === ui.saved[id]) delete ui.saved[id]
        }
      } else {
        misses++
      }
    } catch {
      misses++
    }
    const r = route()
    if (r.name === 'docs' && state && state.docs.length) {
      const doc = state.docs.find(d => d.id === r.id) || state.docs[0]
      await loadFile(doc.path)
    }
    render()
  }

  const loadFile = async p => {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(p)}`, { headers: headers(), cache: 'no-store' })
      if (!res.ok) return
      const f = await res.json()
      const old = ui.files[p]
      if (!old || old.content !== f.content || old.exists !== f.exists) ui.files[p] = f
    } catch {}
  }

  const send = async (type, payload = {}) => {
    try {
      await fetch('/api/action', { method: 'POST', headers: headers(), body: JSON.stringify({ type, ...payload }) })
    } catch {
      misses = 3
    }
    for (const ms of [250, 700, 1500]) setTimeout(poll, ms)
  }

  const flash = text => {
    ui.toast = text
    render()
    setTimeout(() => {
      ui.toast = ''
      render()
    }, 2200)
  }

  const submit = id => {
    const key = 'd:' + id
    const text = (ui.drafts[key] || '').trim()
    if (!text) return
    const item = state.docs.find(x => x.id === id)
    if (!item) return
    ui.outbox.push({ key, text, base: userCount(item.thread) })
    ui.drafts[key] = ''
    send('message', { id, text })
    render()
  }

  /**
   * After a first answer, the next question without one, wrapping back to the first
   * one still open; when none is left, Finalização. Later edits stay where they are.
   */
  const advanceFrom = id => {
    const at = state.questions.findIndex(q => q.id === id)
    const next = state.questions.slice(at + 1).concat(state.questions.slice(0, at)).find(q => !isAnswered(q))
    ui.nextNav = next ? 'fwd' : 'rise'
    location.hash = next ? `#/q/${next.id}` : '#/fim'
  }

  const saveAnswer = (id, text) => {
    const q = state.questions.find(x => x.id === id)
    const isFirst = q && !isAnswered(q)
    ui.saved[id] = text
    delete ui.drafts['q:' + id]
    ui.editing[id] = false
    send('save', { id, text })
    if (isFirst) advanceFrom(id)
    render()
  }

  const patch = (list, id, fn) => {
    const item = list.find(x => x.id === id)
    if (item) fn(item)
  }

  const actions = {
    nav: el => {
      location.hash = el.dataset.to
    },
    send: el => submit(el.dataset.id),
    save: el => saveAnswer(el.dataset.id, (ui.drafts['q:' + el.dataset.id] || '').trim()),
    useRec: el => {
      const q = state.questions.find(x => x.id === el.dataset.id)
      if (!q) return
      const isFirst = !isAnswered(q)
      ui.saved[q.id] = recAnswer(q)
      ui.editing[q.id] = false
      delete ui.drafts['q:' + q.id]
      send('useRec', { id: q.id })
      if (isFirst) advanceFrom(q.id)
      render()
    },
    // One click on an alternative saves it as the answer, like "Salvar" does.
    pick: el => {
      const q = state.questions.find(x => x.id === el.dataset.id)
      const text = q ? optionAnswer(q, el.dataset.key) : ''
      ui.pending = null
      if (!text) return
      const isFirst = !isAnswered(q)
      ui.saved[q.id] = text
      ui.editing[q.id] = false
      delete ui.drafts['q:' + q.id]
      send('pick', { id: q.id, key: el.dataset.key })
      if (isFirst) advanceFrom(q.id)
      render()
    },
    edit: el => {
      const q = state.questions.find(x => x.id === el.dataset.id)
      if (!q) return
      ui.drafts['q:' + q.id] = draftOf(q)
      ui.editing[q.id] = true
      render()
    },
    cancelEdit: el => {
      delete ui.drafts['q:' + el.dataset.id]
      ui.editing[el.dataset.id] = false
      render()
    },
    submit: () => {
      const command = ui.command !== null ? ui.command : defaultCommand()
      const at = Date.now()
      for (const q of state.questions) {
        const d = draftOf(q)
        if (!d) continue
        q.thread = q.thread.concat({ from: 'user', text: d, at })
        q.draft = ''
        q.isAwaiting = true
        q.isOpen = false
        delete ui.saved[q.id]
        delete ui.drafts['q:' + q.id]
      }
      state.isWritingDocs = true
      state.command = command
      send('submit', { command })
      render()
    },
    // The selection step. Each click carries the value it sets ('on' / 'off'), and the page shows it at once.
    setTerm: el => {
      if (!state.plan) return
      patch(state.plan.terms, el.dataset.id, t => (t.isSelected = el.dataset.key === 'on'))
      send('setTerm', { id: el.dataset.id, key: el.dataset.key })
      render()
    },
    termsAll: el => {
      if (!state.plan) return
      state.plan.terms.forEach(t => (t.isSelected = el.dataset.key === 'on'))
      send('termsAll', { key: el.dataset.key })
      render()
    },
    setAdr: el => {
      if (!state.plan) return
      patch(state.plan.adrs, el.dataset.id, a => (a.isConfirmed = el.dataset.key === 'on'))
      send('setAdr', { id: el.dataset.id, key: el.dataset.key })
      render()
    },
    confirmAllAdrs: () => {
      if (!state.plan) return
      state.plan.adrs.forEach(a => (a.isConfirmed = true))
      send('confirmAllAdrs')
      render()
    },
    setExtra: el => {
      if (!state.plan) return
      const e = state.plan.extras.find(x => x.type === el.dataset.id)
      if (e) e.isSelected = el.dataset.key === 'on'
      send('setExtra', { id: el.dataset.id, key: el.dataset.key })
      render()
    },
    createDocs: () => {
      state.phase = 'documents'
      state.isWritingDocs = true
      ui.nextNav = 'rise'
      send('createDocs')
      location.hash = '#/docs'
    },
    approve: el => {
      patch(state.docs, el.dataset.id, d => (d.isApproved = true))
      send('approve', { id: el.dataset.id })
      render()
    },
    unapprove: el => {
      patch(state.docs, el.dataset.id, d => (d.isApproved = false))
      send('unapprove', { id: el.dataset.id })
      render()
    },
    finish: () => {
      state.phase = 'done'
      send('finish')
      render()
    },
    openFile: el => {
      send('openFile', { path: el.dataset.path })
      flash('Abrindo o arquivo no seu editor…')
    },
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]')
    if (!el || el.disabled || !state) return
    const fn = actions[el.dataset.act]
    if (fn) fn(el)
  })

  document.addEventListener('submit', e => {
    if (!e.target.hasAttribute || !e.target.hasAttribute('data-add-term')) return
    e.preventDefault()
    const text = (ui.drafts.term || '').trim()
    if (!text || !state) return
    // The field is typed into without a redraw, so the page may see no change: clear it here too.
    ui.drafts.term = ''
    e.target.reset()
    const add = e.target.querySelector('[data-send-for]')
    if (add) add.disabled = true
    send('addTerm', { text })
    render()
  })

  document.addEventListener('input', e => {
    const t = e.target
    if (t.dataset && t.dataset.draft) {
      ui.drafts[t.dataset.draft] = t.value
      const btn = document.querySelector(`[data-send-for="${CSS.escape(t.dataset.draft)}"]`)
      if (btn) btn.disabled = !t.value.trim()
    } else if (t.hasAttribute && t.hasAttribute('data-command')) {
      ui.command = t.value
    }
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.dataset && e.target.dataset.draft) {
      const btn = document.querySelector(`[data-send-for="${CSS.escape(e.target.dataset.draft)}"]`)
      if (btn && !btn.disabled) btn.click()
      return
    }
    // A letter highlights the alternative with that letter and Enter confirms it, unless the person is typing.
    if (!state || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.target.closest && e.target.closest('textarea, input, select, [contenteditable]')) return
    // Enter on a focused button or link already activates it.
    if (e.key === 'Enter' && e.target.closest && e.target.closest('a, button')) return
    const live = k => [...document.querySelectorAll('.main .opt[data-key]')].find(o => !o.disabled && o.dataset.key === k)
    if (e.key === 'Enter' && ui.pending) {
      const opt = live(ui.pending.key)
      if (opt) {
        e.preventDefault()
        opt.click()
      }
    } else if (/^[a-z]$/i.test(e.key)) {
      const opt = live(e.key.toUpperCase())
      if (opt) {
        e.preventDefault()
        ui.pending = { id: opt.dataset.id, key: opt.dataset.key }
        render()
      }
    } else if (e.key === 'Escape' && ui.pending) {
      ui.pending = null
      render()
    }
  })

  document.addEventListener(
    'toggle',
    e => {
      if (e.target.id === 'full') ui.openFull = e.target.open
    },
    true,
  )

  window.addEventListener('hashchange', () => {
    ui.pending = null
    ui.visitedFinal = true
    lastHtml = ''
    poll()
  })

  render()
  poll()
  setInterval(poll, 1200)
})()
