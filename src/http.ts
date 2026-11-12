import { BrisaConnectionError, BrisaError, BrisaTimeoutError, errorFor } from './errors.js'
import type { Problem } from './types.js'
import { VERSION } from './version.js'

export const DEFAULT_BASE_URL = 'https://api.brisa.ao'

export interface BrisaOptions {
  /** A chave de API (`brk_...` em produção, `brk_sbx...` na sandbox). Por omissão, `process.env.BRISA_API_KEY`. */
  apiKey?: string
  /** Por omissão `https://api.brisa.ao` (ou `process.env.BRISA_API_URL`). A chave escolhe o ambiente, não o endereço. */
  baseUrl?: string
  /** Tempo máximo de cada tentativa, em milissegundos (por omissão 30 000). */
  timeoutMs?: number
  /** Repetições em `429`, `502`, `503` e falhas de rede (por omissão 2). */
  maxRetries?: number
  /** Espera máxima aceite de um `Retry-After`, em milissegundos (por omissão 60 000): acima disso o erro sobe logo. */
  maxRetryDelayMs?: number
  /** Uma implementação de `fetch` (por omissão a global). */
  fetch?: typeof fetch
  /** Cabeçalhos acrescentados a todos os pedidos. */
  headers?: Record<string, string>
}

export interface RequestOptions {
  /** `Idempotency-Key` (8 a 128 caracteres `A-Z a-z 0-9 _ . : -`). Nas criações, o SDK gera um se não o indicar. */
  idempotencyKey?: string
  signal?: AbortSignal
  timeoutMs?: number
  maxRetries?: number
  headers?: Record<string, string>
}

export interface RateLimit {
  /** Pedidos permitidos por minuto. */
  limit: number
  /** Pedidos que ainda pode fazer. */
  remaining: number
  /** Segundos até o contador repor. */
  reset: number
}

export interface ApiResponse<T> {
  data: T
  status: number
  headers: Headers
  /** `true` quando a resposta é a de uma tentativa anterior com o mesmo `Idempotency-Key`. */
  replayed: boolean
  rateLimit?: RateLimit
}

export type ResponseKind = 'json' | 'text' | 'bytes'

export interface Request {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  query?: object
  body?: unknown
  /** Como ler a resposta (por omissão JSON). */
  as?: ResponseKind
  accept?: string
}

const RETRYABLE = new Set([429, 502, 503])

function env(name: string): string | undefined {
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return p?.env?.[name]
}

/** Gera um `Idempotency-Key` aleatório (`brisa-js-<uuid>`). */
export function idempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return `brisa-js-${c.randomUUID()}`
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  return `brisa-js-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

/** Segundos de um `Retry-After` (número ou data HTTP). */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  if (Number.isFinite(n)) return Math.max(0, n)
  const t = Date.parse(value)
  return Number.isNaN(t) ? undefined : Math.max(0, Math.ceil((t - now) / 1000))
}

function rateLimitOf(h: Headers): RateLimit | undefined {
  const limit = h.get('x-ratelimit-limit')
  if (limit === null) return undefined
  return { limit: Number(limit), remaining: Number(h.get('x-ratelimit-remaining') ?? 0), reset: Number(h.get('x-ratelimit-reset') ?? 0) }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(signal.reason)
      },
      { once: true },
    )
  })

export class HttpClient {
  readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly maxRetryDelayMs: number
  private readonly fetchImpl: typeof fetch
  private readonly headers: Record<string, string>
  /** Os limites de pedidos da última resposta. */
  lastRateLimit?: RateLimit

  constructor(options: BrisaOptions = {}) {
    const apiKey = options.apiKey ?? env('BRISA_API_KEY')
    if (!apiKey) throw new BrisaError('Falta a chave de API: passe { apiKey } ou defina BRISA_API_KEY.')
    this.apiKey = apiKey
    this.baseUrl = (options.baseUrl ?? env('BRISA_API_URL') ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.maxRetries = options.maxRetries ?? 2
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 60_000
    const f = options.fetch ?? (globalThis.fetch as typeof fetch | undefined)
    if (!f) throw new BrisaError('Não há fetch neste ambiente: use Node.js 18+ ou passe { fetch }.')
    this.fetchImpl = f
    this.headers = options.headers ?? {}
  }

  url(path: string, query?: object): string {
    const u = new URL(this.baseUrl + path)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue
        if (Array.isArray(v)) for (const x of v) u.searchParams.append(k, String(x))
        else u.searchParams.set(k, String(v))
      }
    }
    return u.toString()
  }

  async request<T>(req: Request, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = this.url(req.path, req.query)
    const headers: Record<string, string> = {
      Accept: req.accept ?? 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...this.headers,
      ...options.headers,
    }
    if (!(globalThis as { window?: unknown }).window) headers['User-Agent'] = `brisa-sdk-js/${VERSION}`
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
    let body: string | undefined
    if (req.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(req.body)
    }
    // a POST is repeated after a network failure only with an Idempotency-Key: otherwise it could be done twice
    const safeToRepeat = req.method !== 'POST' || options.idempotencyKey !== undefined
    const maxRetries = options.maxRetries ?? this.maxRetries
    const timeoutMs = options.timeoutMs ?? this.timeoutMs

    for (let attempt = 0; ; attempt++) {
      let res: Response
      const timeout = new AbortController()
      const timer = setTimeout(() => timeout.abort(), timeoutMs)
      const onAbort = () => timeout.abort()
      options.signal?.addEventListener('abort', onAbort, { once: true })
      try {
        res = await this.fetchImpl(url, { method: req.method, headers, body, signal: timeout.signal })
      } catch (e) {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', onAbort)
        if (options.signal?.aborted) throw e
        const err = timeout.signal.aborted
          ? new BrisaTimeoutError(`A API não respondeu em ${timeoutMs} ms (${req.method} ${req.path}).`, { cause: e })
          : new BrisaConnectionError(`Não foi possível falar com a API (${req.method} ${req.path}): ${(e as Error)?.message ?? e}`, { cause: e })
        if (safeToRepeat && attempt < maxRetries) {
          await sleep(backoff(attempt), options.signal)
          continue
        }
        throw err
      }
      try {
        this.lastRateLimit = rateLimitOf(res.headers) ?? this.lastRateLimit
        if (res.ok) {
          const data = await read<T>(res, req.as ?? 'json')
          return {
            data,
            status: res.status,
            headers: res.headers,
            replayed: res.headers.get('idempotent-replayed') === 'true',
            rateLimit: rateLimitOf(res.headers),
          }
        }
        const retryAfter = parseRetryAfter(res.headers.get('retry-after'))
        const problem = await problemOf(res, req)
        if (RETRYABLE.has(res.status) && attempt < maxRetries) {
          const wait = retryAfter !== undefined ? retryAfter * 1000 : backoff(attempt)
          if (wait <= this.maxRetryDelayMs) {
            await sleep(wait, options.signal)
            continue
          }
        }
        throw errorFor(problem, res.headers, retryAfter)
      } finally {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', onAbort)
      }
    }
  }
}

/** 0,5 s, 1 s, 2 s... (até 8 s), com variação aleatória. */
function backoff(attempt: number): number {
  const base = Math.min(8000, 500 * 2 ** attempt)
  return Math.round(base / 2 + Math.random() * (base / 2))
}

async function read<T>(res: Response, as: ResponseKind): Promise<T> {
  if (res.status === 204) return undefined as T
  if (as === 'bytes') return new Uint8Array(await res.arrayBuffer()) as T
  const text = await res.text()
  if (as === 'text') return text as T
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

async function problemOf(res: Response, req: Request): Promise<Problem> {
  const text = await res.text().catch(() => '')
  try {
    const p = JSON.parse(text)
    if (p && typeof p === 'object') return { ...p, status: typeof p.status === 'number' ? p.status : res.status, type: p.type ?? 'about:blank', title: p.title ?? res.statusText }
  } catch {
    // not JSON: a proxy or gateway answered
  }
  return { type: 'about:blank', title: res.statusText || `HTTP ${res.status}`, status: res.status, detail: text.slice(0, 500) || undefined, instance: req.path }
}
