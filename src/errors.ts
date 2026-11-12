import type { Problem } from './types.js'

/** Base de todos os erros do SDK. */
export class BrisaError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
  }
}

/**
 * A API respondeu com um erro (RFC 9457, `application/problem+json`).
 * Programe contra `status`, `type` e `field`, não contra o texto de `detail` (em português, pode variar).
 */
export class BrisaApiError extends BrisaError {
  /** O estado HTTP. */
  readonly status: number
  /** `urn:brisa:...`: identificador estável do tipo de problema. */
  readonly type: string
  readonly title: string
  readonly detail?: string
  readonly instance?: string
  /** O campo que causou o erro (regras fiscais, `422`). */
  readonly field?: string
  /** Erros de validação (`400`): `campo: mensagem`. */
  readonly errors?: Record<string, string>
  /** O documento de erro completo, incluindo membros que o SDK não conhece. */
  readonly problem: Problem
  /** Segundos a esperar (`Retry-After`), quando a API os indicou. */
  readonly retryAfter?: number
  readonly headers: Headers

  constructor(problem: Problem, headers: Headers, retryAfter?: number) {
    super(`${problem.status} ${problem.title}${problem.detail ? `: ${problem.detail}` : ''}`)
    this.status = problem.status
    this.type = problem.type
    this.title = problem.title
    this.detail = problem.detail
    this.instance = problem.instance
    this.field = problem.field
    this.errors = problem.errors
    this.problem = problem
    this.headers = headers
    this.retryAfter = retryAfter
  }

  /** `true` para `429`, `502` e `503`: repetir mais tarde (com o mesmo `Idempotency-Key`). */
  get retryable(): boolean {
    return this.status === 429 || this.status === 502 || this.status === 503
  }
}

/** `400`: o corpo não é válido; `errors` diz quais campos. */
export class BrisaValidationError extends BrisaApiError {}
/** `401`: chave inválida, expirada, revogada, de outro ambiente ou de um endereço não autorizado. */
export class BrisaAuthenticationError extends BrisaApiError {}
/** `402`: o plano não permite (`limite-do-plano`, `plano-sem-api`) ou a subscrição está inativa. */
export class BrisaPlanError extends BrisaApiError {
  /** O que se esgotou (`invoices`, `clients`, `products`, `users`), nos erros de limite do plano. */
  get metric(): string | undefined {
    return this.problem.metric
  }
  /** O máximo do plano. */
  get limit(): number | undefined {
    return this.problem.limit
  }
}
/** `403`: a chave não tem a permissão necessária. */
export class BrisaPermissionError extends BrisaApiError {}
/** `404`: não existe nesta empresa (ou está no outro ambiente). */
export class BrisaNotFoundError extends BrisaApiError {}
/** `409`: o recurso ainda não está pronto (ex.: SAF-T ainda a gerar). */
export class BrisaConflictError extends BrisaApiError {}
/** `422`: uma regra fiscal recusou a operação (ou um `Idempotency-Key` foi reutilizado com outro corpo). */
export class BrisaRuleError extends BrisaApiError {}
/** `429`: demasiados pedidos; espere `retryAfter` segundos. */
export class BrisaRateLimitError extends BrisaApiError {}
/** `5xx`: a AGT ou o serviço estão temporariamente indisponíveis. */
export class BrisaServerError extends BrisaApiError {}

/** Não foi possível falar com a API (rede, DNS, TLS). */
export class BrisaConnectionError extends BrisaError {}
/** A API não respondeu dentro do tempo (`timeoutMs`). */
export class BrisaTimeoutError extends BrisaConnectionError {}
/** A assinatura de um webhook não é válida (ou está fora da tolerância de tempo). */
export class BrisaWebhookSignatureError extends BrisaError {}

export function errorFor(problem: Problem, headers: Headers, retryAfter?: number): BrisaApiError {
  const s = problem.status
  const C =
    s === 400
      ? BrisaValidationError
      : s === 401
        ? BrisaAuthenticationError
        : s === 402
          ? BrisaPlanError
          : s === 403
            ? BrisaPermissionError
            : s === 404
              ? BrisaNotFoundError
              : s === 409
                ? BrisaConflictError
                : s === 422
                  ? BrisaRuleError
                  : s === 429
                    ? BrisaRateLimitError
                    : s >= 500
                      ? BrisaServerError
                      : BrisaApiError
  return new C(problem, headers, retryAfter)
}
