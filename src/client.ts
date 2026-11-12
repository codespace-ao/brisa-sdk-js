import { type ApiResponse, type BrisaOptions, HttpClient, type RateLimit, type Request, type RequestOptions } from './http.js'
import { Documents } from './resources/documents.js'
import { Catalog, Clients, Products, Saft } from './resources/others.js'
import type { Company, Me } from './types.js'
import { verifyWebhook } from './webhooks.js'

/**
 * Cliente da API Brisa.
 *
 * ```ts
 * import { Brisa } from '@codespace-ao/brisa'
 * const brisa = new Brisa({ apiKey: process.env.BRISA_API_KEY })
 * const doc = await brisa.documents.issue({ type: 'FT', clientId: 42, lines: [{ productCode: 'PAR-M8', quantity: 4 }] })
 * ```
 */
export class Brisa {
  readonly documents: Documents
  readonly clients: Clients
  readonly products: Products
  readonly catalog: Catalog
  readonly saft: Saft
  /** Verificação de webhooks (também exportada como `verifyWebhook`). */
  static readonly webhooks = { verify: verifyWebhook }
  private readonly http: HttpClient

  constructor(options: BrisaOptions = {}) {
    this.http = new HttpClient(options)
    this.documents = new Documents(this.http)
    this.clients = new Clients(this.http)
    this.products = new Products(this.http)
    this.catalog = new Catalog(this.http)
    this.saft = new Saft(this.http)
  }

  get baseUrl(): string {
    return this.http.baseUrl
  }

  /** Os limites de pedidos indicados na última resposta (`X-RateLimit-*`). */
  get rateLimit(): RateLimit | undefined {
    return this.http.lastRateLimit
  }

  /** Quem é a chave e que permissões tem (`GET /api/v1/me`). */
  async me(options?: RequestOptions): Promise<Me> {
    return (await this.http.request<Me>({ method: 'GET', path: '/api/v1/me' }, options)).data
  }

  /** Os dados da empresa da chave (`GET /api/v1/company`). */
  async company(options?: RequestOptions): Promise<Company> {
    return (await this.http.request<Company>({ method: 'GET', path: '/api/v1/company' }, options)).data
  }

  /** Um pedido qualquer à API, com autenticação, repetições e erros do SDK; devolve também o estado e os cabeçalhos. */
  request<T = unknown>(req: Request, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.http.request<T>(req, options)
  }
}
