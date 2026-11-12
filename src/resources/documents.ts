import { type HttpClient, idempotencyKey, type RequestOptions } from '../http.js'
import { paginate } from '../pagination.js'
import type {
  CancelDocumentRequest,
  CreditedLine,
  CreditNoteRequest,
  DocumentDetail,
  DocumentExport,
  DocumentHistory,
  DocumentSummary,
  GlobalPaymentRequest,
  IssueDocumentRequest,
  IssuedDocument,
  ListDocumentsParams,
  Page,
  PayDocumentRequest,
  PaymentResult,
  PdfOptions,
  RectifyDocumentRequest,
  SendDocumentRequest,
  SendResult,
} from '../types.js'

const id = (n: number | string) => encodeURIComponent(String(n))
/** The operations that need (or recommend) an Idempotency-Key get one made here when none is given, so that a retry repeats the same key. */
const withKey = (o: RequestOptions = {}): RequestOptions => ({ ...o, idempotencyKey: o.idempotencyKey ?? idempotencyKey() })

/** Documentos fiscais: emitir, consultar, PDF, pagamentos, anulações e notas de crédito. */
export class Documents {
  constructor(private readonly http: HttpClient) {}

  /** Emite `FT`, `FR`, `TV` ou `PF` (`POST /api/v1/documents`). Permissão `invoices.issue`. */
  async issue(body: IssueDocumentRequest, options?: RequestOptions): Promise<IssuedDocument> {
    return (await this.http.request<IssuedDocument>({ method: 'POST', path: '/api/v1/documents', body }, withKey(options))).data
  }

  /** Uma página de documentos, do mais recente para o mais antigo. Permissão `invoices.view`. */
  async list(params: ListDocumentsParams = {}, options?: RequestOptions): Promise<Page<DocumentSummary>> {
    return (await this.http.request<Page<DocumentSummary>>({ method: 'GET', path: '/api/v1/documents', query: params }, options)).data
  }

  /** Todos os documentos que correspondem aos filtros, página a página. */
  listAll(params: ListDocumentsParams = {}, options?: RequestOptions): AsyncGenerator<DocumentSummary, void, undefined> {
    return paginate((p) => this.list(p, options), params)
  }

  /** Um documento, com linhas, totais, valor em dívida e estado na AGT. */
  async get(documentId: number, options?: RequestOptions): Promise<DocumentDetail> {
    return (await this.http.request<DocumentDetail>({ method: 'GET', path: `/api/v1/documents/${id(documentId)}` }, options)).data
  }

  /** O PDF do documento (bytes). Conta como mais de um pedido no limite da chave: guarde-o em vez de o pedir de cada vez. */
  async pdf(documentId: number, params: PdfOptions = {}, options?: RequestOptions): Promise<Uint8Array> {
    return (await this.http.request<Uint8Array>({ method: 'GET', path: `/api/v1/documents/${id(documentId)}/pdf`, query: params, as: 'bytes', accept: 'application/pdf' }, options))
      .data
  }

  /** O documento como dados: JSON (por omissão) ou XML (texto). Permissão `invoices.export`. */
  export(documentId: number, format?: 'json', options?: RequestOptions): Promise<DocumentExport>
  export(documentId: number, format: 'xml', options?: RequestOptions): Promise<string>
  async export(documentId: number, format: 'json' | 'xml' = 'json', options?: RequestOptions): Promise<DocumentExport | string> {
    const xml = format === 'xml'
    return (
      await this.http.request<DocumentExport | string>(
        { method: 'GET', path: `/api/v1/documents/${id(documentId)}/export`, query: { format }, as: xml ? 'text' : 'json', accept: xml ? 'application/xml' : 'application/json' },
        options,
      )
    ).data
  }

  /** Paga o documento, no todo (sem `amount`) ou em parte, e emite o recibo (`RC`). Permissão `invoices.payments`. */
  async pay(documentId: number, body: PayDocumentRequest, options?: RequestOptions): Promise<PaymentResult> {
    return (await this.http.request<PaymentResult>({ method: 'POST', path: `/api/v1/documents/${id(documentId)}/payments`, body }, withKey(options))).data
  }

  /** Liquida várias faturas de um mesmo cliente num recibo global (`RG`). */
  async payGlobal(body: GlobalPaymentRequest, options?: RequestOptions): Promise<IssuedDocument> {
    return (await this.http.request<IssuedDocument>({ method: 'POST', path: '/api/v1/documents/payments/global', body }, withKey(options))).data
  }

  /** Anula o documento (numa fatura emitida, só com `basis`). Repetido, dá o mesmo resultado. Permissão `invoices.cancel`. */
  async cancel(documentId: number, body: CancelDocumentRequest, options?: RequestOptions): Promise<void> {
    await this.http.request<void>({ method: 'POST', path: `/api/v1/documents/${id(documentId)}/cancel`, body }, options)
  }

  /** Retifica: emite uma nota de crédito (`NC`) que espelha o original. */
  async rectify(documentId: number, body: RectifyDocumentRequest, options?: RequestOptions): Promise<IssuedDocument> {
    return (await this.http.request<IssuedDocument>({ method: 'POST', path: `/api/v1/documents/${id(documentId)}/rectify`, body }, withKey(options))).data
  }

  /** Nota de crédito parcial (ou total, sem `lines`). */
  async creditNote(documentId: number, body: CreditNoteRequest, options?: RequestOptions): Promise<IssuedDocument> {
    return (await this.http.request<IssuedDocument>({ method: 'POST', path: `/api/v1/documents/${id(documentId)}/credit-notes`, body }, withKey(options))).data
  }

  /** Quanto de cada linha já foi creditado e quanto ainda se pode creditar. */
  async credits(documentId: number, options?: RequestOptions): Promise<CreditedLine[]> {
    return (await this.http.request<CreditedLine[]>({ method: 'GET', path: `/api/v1/documents/${id(documentId)}/credits` }, options)).data
  }

  /** O histórico do documento (auditoria e envios). */
  async history(documentId: number, options?: RequestOptions): Promise<DocumentHistory> {
    return (await this.http.request<DocumentHistory>({ method: 'GET', path: `/api/v1/documents/${id(documentId)}/history` }, options)).data
  }

  /** Muda a data de vencimento (AAAA-MM-DD, até 365 dias depois da emissão). */
  async setDueDate(documentId: number, dueDate: string, options?: RequestOptions): Promise<void> {
    await this.http.request<void>({ method: 'PUT', path: `/api/v1/documents/${id(documentId)}/due-date`, body: { dueDate } }, options)
  }

  /** Envia o documento por e-mail. Com uma chave de API, só ao e-mail do cliente que consta do documento. Permissão `invoices.send`. */
  async send(documentId: number, body: SendDocumentRequest = {}, options?: RequestOptions): Promise<SendResult> {
    return (await this.http.request<SendResult>({ method: 'POST', path: `/api/v1/documents/${id(documentId)}/send`, body }, options)).data
  }
}
