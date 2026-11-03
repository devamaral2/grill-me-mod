#!/usr/bin/env node
// Local server for the grill-me-mod page. No dependencies.
//
//   GET  /                 the page (app/public)
//   GET  /api/state        the session's state file, 204 while `?rev=` is current
//   GET  /api/file?path=   a project file's text, for the document preview
//   POST /api/action       a person's action: written to stdout as one JSON
//                          line, which the mod reads and applies
//
// The state file is written by the mod alone; this server only reads it.
// stdout carries `{"type":"ready","port":N}` once, then `{"type":"action",...}`.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null))
    .filter(Boolean),
)

const root = path.resolve(args.root ?? process.cwd())
const statePath = path.resolve(args.state ?? path.join(root, '.grill-me', 'state.json'))
const publicDir = path.resolve(
  args.public ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'public'),
)
const token = args.token ?? ''

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
}

let lastGood = { rev: 0 }
const readState = () => {
  try {
    lastGood = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {
    // Missing before the first write, or caught mid-write: keep the last good.
  }
  return lastGood
}

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

const inside = rel => {
  const abs = path.resolve(root, rel)
  return abs === root || abs.startsWith(root + path.sep) ? abs : null
}

const opener = abs => {
  const editor = process.env.GRILL_EDITOR
  const [cmd, ...rest] = editor
    ? editor.split(' ')
    : process.platform === 'darwin'
      ? ['open']
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '']
        : ['xdg-open']
  const child = spawn(cmd, [...rest, abs], { stdio: 'ignore', detached: true })
  child.on('error', () => {})
  child.unref()
}

const readBody = req =>
  new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', c => {
      raw += c
      if (raw.length > 1_000_000) reject(new Error('too large'))
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const host = (req.headers.host ?? '').split(':')[0]
  if (host !== '127.0.0.1' && host !== 'localhost') return send(res, 403, '{}')

  if (url.pathname.startsWith('/api/')) {
    if (token && req.headers['x-grill-token'] !== token) return send(res, 401, '{"error":"token"}')

    if (req.method === 'GET' && url.pathname === '/api/state') {
      const state = readState()
      if (url.searchParams.get('rev') === String(state.rev)) {
        res.writeHead(204, { 'cache-control': 'no-store' })
        return res.end()
      }
      return send(res, 200, JSON.stringify(state))
    }

    if (req.method === 'GET' && url.pathname === '/api/file') {
      const rel = url.searchParams.get('path') ?? ''
      const abs = inside(rel)
      if (!abs) return send(res, 400, '{"error":"outside project"}')
      try {
        const stat = fs.statSync(abs)
        if (!stat.isFile() || stat.size > 1_000_000) throw new Error('not a file')
        return send(res, 200, JSON.stringify({ path: rel, exists: true, content: fs.readFileSync(abs, 'utf8') }))
      } catch {
        return send(res, 200, JSON.stringify({ path: rel, exists: false, content: '' }))
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/action') {
      let action
      try {
        action = JSON.parse(await readBody(req))
      } catch {
        return send(res, 400, '{"error":"json"}')
      }
      if (action.type === 'openFile') {
        const abs = inside(String(action.path ?? ''))
        if (abs && fs.existsSync(abs)) opener(abs)
        return send(res, 200, '{"ok":true}')
      }
      process.stdout.write(JSON.stringify({ ...action, type: 'action', action: action.type }) + '\n')
      return send(res, 200, '{"ok":true}')
    }

    return send(res, 404, '{}')
  }

  // Static files, never outside publicDir.
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1))
  const abs = path.resolve(publicDir, rel)
  if (!abs.startsWith(publicDir + path.sep)) return send(res, 403, '{}')
  try {
    send(res, 200, fs.readFileSync(abs), TYPES[path.extname(abs)] ?? 'application/octet-stream')
  } catch {
    send(res, 404, '{}')
  }
})

server.listen(Number(args.port ?? 0), '127.0.0.1', () => {
  const { port } = server.address()
  process.stdout.write(JSON.stringify({ type: 'ready', port }) + '\n')
})

// The mod owns this process and kills it when it unloads.
