import { BrisaError } from '../errors.js'
import { type HttpClient, idempotencyKey, type RequestOptions } from '../http.js'
import { paginate } from '../pagination.js'
import type {
  Category,
  Client,
  ClientInput,
  CompanyTax,
  ExemptionReason,
  ListClientsParams,
  ListProductsParams,
  Page,
  Product,
  ProductInput,
  SaftExport,
  StockLevel,
  StockMovementRequest,
} from '../types.js'

const seg = (v: number | string) => encodeURIComponent(String(v))

/** Clientes da empresa. */
export class Clients {
  constructor(private readonly http: HttpClient) {}

  /** Regista um cliente e devolve o seu `id`. Permissão `clients.manage`. */
  async create(body: ClientInput, options: RequestOptions = {}): Promise<{ id: number }> {
    const o = { ...options, idempotencyKey: options.idempotencyKey ?? idempotencyKey() }
    return (await this.http.request<{ id: number }>({ method: 'POST', path: '/api/v1/clients', body }, o)).data
  }

  /** Substitui os dados do cliente: envie o corpo completo (com `taxId`). */
  async update(clientId: number, body: ClientInput & { taxId: string }, options?: RequestOptions): Promise<void> {
    await this.http.request<void>({ method: 'PUT', path: `/api/v1/clients/${seg(clientId)}`, body }, options)
  }

  async get(clientId: number, options?: RequestOptions): Promise<Client> {
    return (await this.http.request<Client>({ method: 'GET', path: `/api/v1/clients/${seg(clientId)}` }, options)).data
  }

  async list(params: ListClientsParams = {}, options?: RequestOptions): Promise<Page<Client>> {
    return (await this.http.request<Page<Client>>({ method: 'GET', path: '/api/v1/clients', query: params }, options)).data
  }

  listAll(params: ListClientsParams = {}, options?: RequestOptions): AsyncGenerator<Client, void, undefined> {
    return paginate((p) => this.list(p, options), params)
  }

  /** Ativa ou desativa o cliente. Permissão `clients.delete`. */
  async setActive(clientId: number, active: boolean, options?: RequestOptions): Promise<void> {
    await this.http.request<void>({ method: 'PUT', path: `/api/v1/clients/${seg(clientId)}/active`, body: { active } }, options)
  }
}

/** Produtos do catálogo e stock. */
export class Products {
  constructor(private readonly http: HttpClient) {}

  /** Cria o produto se o código não existir; senão atualiza-o. Permissão `products.manage`. */
  async upsert(code: string, body: ProductInput, options?: RequestOptions): Promise<Product> {
    return (await this.http.request<Product>({ method: 'PUT', path: `/api/v1/catalog/products/${seg(code)}`, body }, options)).data
  }

  /** Um produto, com o stock atual. */
  async get(code: string, options?: RequestOptions): Promise<Product> {
    return (await this.http.request<Product>({ method: 'GET', path: `/api/v1/catalog/products/${seg(code)}` }, options)).data
  }

  async list(params: ListProductsParams = {}, options?: RequestOptions): Promise<Page<Product>> {
    return (await this.http.request<Page<Product>>({ method: 'GET', path: '/api/v1/catalog/products', query: params }, options)).data
  }

  listAll(params: ListProductsParams = {}, options?: RequestOptions): AsyncGenerator<Product, void, undefined> {
    return paginate((p) => this.list(p, options), params)
  }

  /** Entrada, saída ou acerto de stock. Permissão `stock.adjust`. */
  async moveStock(code: string, body: StockMovementRequest, options: RequestOptions = {}): Promise<StockLevel> {
    const o = { ...options, idempotencyKey: options.idempotencyKey ?? idempotencyKey() }
    return (await this.http.request<StockLevel>({ method: 'POST', path: `/api/v1/products/${seg(code)}/movements`, body }, o)).data
  }
}

/** Impostos, motivos de isenção e categorias. */
export class Catalog {
  constructor(private readonly http: HttpClient) {}

  /** Os impostos da empresa: o `id` é o `taxId` dos produtos; uma linha só aceita impostos daqui. */
  async taxes(params: { activeOnly?: boolean } = {}, options?: RequestOptions): Promise<CompanyTax[]> {
    return (await this.http.request<CompanyTax[]>({ method: 'GET', path: '/api/v1/catalog/taxes', query: params }, options)).data
  }

  /** Os motivos de isenção `M00`…`M94` aceites pela AGT. */
  async exemptionReasons(options?: RequestOptions): Promise<ExemptionReason[]> {
    return (await this.http.request<ExemptionReason[]>({ method: 'GET', path: '/api/v1/catalog/exemption-reasons' }, options)).data
  }

  async categories(options?: RequestOptions): Promise<Category[]> {
    return (await this.http.request<Category[]>({ method: 'GET', path: '/api/v1/catalog/categories' }, options)).data
  }
}

/** Ficheiros SAF-T (AO). Permissão `saft.export`. */
export class Saft {
  constructor(private readonly http: HttpClient) {}

  /** Pede a exportação de um período (o fim não pode ser no futuro). Gera-se em segundo plano: veja `get` ou `waitUntilReady`. */
  async request(period: { from: string; to: string }, options?: RequestOptions): Promise<SaftExport> {
    return (await this.http.request<SaftExport>({ method: 'POST', path: '/api/v1/saft/exports', body: period }, options)).data
  }

  async list(params: { limit?: number } = {}, options?: RequestOptions): Promise<SaftExport[]> {
    return (await this.http.request<SaftExport[]>({ method: 'GET', path: '/api/v1/saft/exports', query: params }, options)).data
  }

  async get(exportId: number, options?: RequestOptions): Promise<SaftExport> {
    return (await this.http.request<SaftExport>({ method: 'GET', path: `/api/v1/saft/exports/${seg(exportId)}` }, options)).data
  }

  /** O XML de uma exportação `READY` (`409` antes disso). Conta como vários pedidos no limite da chave. */
  async file(exportId: number, options?: RequestOptions): Promise<string> {
    return (await this.http.request<string>({ method: 'GET', path: `/api/v1/saft/exports/${seg(exportId)}/file`, as: 'text', accept: 'application/xml' }, options)).data
  }

  /** Espera até a exportação ficar `READY` (ou falha com `FAILED`). */
  async waitUntilReady(exportId: number, { intervalMs = 3000, timeoutMs = 300_000 } = {}, options?: RequestOptions): Promise<SaftExport> {
    const until = Date.now() + timeoutMs
    for (;;) {
      const e = await this.get(exportId, options)
      if (e.status === 'READY') return e
      if (e.status === 'FAILED') throw new BrisaError(`A exportação SAF-T ${exportId} falhou: ${e.error ?? 'sem detalhe'}`)
      if (Date.now() + intervalMs > until) throw new BrisaError(`A exportação SAF-T ${exportId} não ficou pronta em ${timeoutMs} ms (estado ${e.status}).`)
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }
}
