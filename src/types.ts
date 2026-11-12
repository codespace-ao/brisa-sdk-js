/**
 * Modelos da API Brisa (REST v1), alinhados com `docs/openapi.json` e com as respostas reais da API.
 * Os campos opcionais (`?`) podem não vir na resposta quando não têm valor.
 */

/** Uma página de uma lista: `page` começa em 0, `size` é no máximo 200. */
export interface Page<T> {
  items: T[]
  page: number
  size: number
  total: number
}

export interface PageParams {
  /** Página, a partir de 0. */
  page?: number
  /** Itens por página, de 1 a 200 (por omissão 50). */
  size?: number
}

/** Valores livres (string) são aceites para não partir com valores novos da API. */
type Open<T extends string> = T | (string & {})

// ---------------------------------------------------------------- documentos

/** Tipos que se emitem com `documents.issue`. */
export type IssuableDocumentType = 'FT' | 'FR' | 'TV' | 'PF'
/** Todos os tipos: os recibos (`RC`, `RG`) e as notas de crédito (`NC`) nascem dos pagamentos e das anulações. */
export type DocumentType = Open<IssuableDocumentType | 'RC' | 'RG' | 'NC'>
export type DocumentState = Open<'issued' | 'paid' | 'cancelled' | 'rectified'>
export type PaymentMethod = Open<'cash' | 'credit_card' | 'debit_card' | 'transfer' | 'check' | 'multicaixa' | 'other'>

/** Um imposto de uma linha: tem de coincidir com um imposto da empresa (ver `catalog.taxes()`). */
export interface LineTax {
  /** Ex.: `IVA 14%`. */
  name: string
  /** Ex.: `14`. */
  percentage: number
  /** Ex.: `IVA`. */
  taxType: string
  /** Ex.: `NOR`, `ISE`. */
  taxCode: string
  /** De 1 a 10, sem repetir na linha. */
  calculationOrder: number
  withholding?: boolean
  /** `AO` ou `AO-CAB`. */
  countryRegion?: string
  reasonCode?: string
}

/** O cliente escrito no próprio documento (em alternativa a `clientId`). */
export interface DocumentCustomer {
  name: string
  /** NIF (9 ou 10 dígitos) ou BI; consumidor final `999999999`. */
  taxId?: string
  address?: string
  email?: string
  phone?: string
  /** ISO 3166-1 alfa-2, ex.: `AO`. */
  country?: string
}

export interface DocumentLineInput {
  quantity: number
  /** Código de um produto do catálogo: traz descrição, preço e impostos. */
  productCode?: string
  /** Obrigatória sem `productCode`. */
  description?: string
  /** Obrigatório sem `productCode`. */
  unitPrice?: number
  /** Obrigatório sem `productCode` (no máximo 5). */
  taxes?: LineTax[]
  discountPercent?: number
  discountAmount?: number
  /** Motivo de isenção `M00`…`M94`, obrigatório em linhas isentas ou não sujeitas. */
  exemptionCode?: string
  exemptionReason?: string
}

export interface PaymentAtIssue {
  method: PaymentMethod
  amountReceived: number
}

export interface IssueDocumentRequest {
  type: IssuableDocumentType
  lines: DocumentLineInput[]
  /** Use este ou `customer`. */
  clientId?: number
  customer?: DocumentCustomer
  /** Omita: é sempre o dia da emissão (em Luanda). */
  issueDate?: string
  /** Data do facto tributável (AAAA-MM-DD). */
  eventDate?: string
  /** Confirma a emissão fora do prazo do `eventDate`. */
  lateIssue?: boolean
  /** Só `AOA`, por agora. */
  currency?: string
  /** Obrigatório em `FR` e `TV`. */
  payment?: PaymentAtIssue
  settlementAmount?: number
  retentionType?: string
  /** AAAA-MM-DD, no máximo 365 dias depois da emissão. */
  dueDate?: string
  paymentTermsDays?: number
  notes?: string
  contingency?: boolean
}

/** Resposta de uma emissão (documento, recibo ou nota de crédito). */
export interface IssuedDocument {
  id: number
  /** Ex.: `FT FT2026/1`. */
  number: string
  sequence: number
  hash: string
  /** Os caracteres 1, 11, 21 e 31 do hash, como impressos (vazio nos recibos). */
  hashControl: string
  grossTotal: number
}

export interface ListDocumentsParams extends PageParams {
  type?: DocumentType
  state?: DocumentState
  /** Emitidos a partir de (AAAA-MM-DD). */
  from?: string
  /** Emitidos até (AAAA-MM-DD). */
  to?: string
  customerTaxId?: string
  /** Texto livre. */
  q?: string
  sort?: Open<'id' | 'number' | 'issueDate' | 'systemEntry' | 'gross' | 'net' | 'customerName' | 'type' | 'amountDue' | 'state'>
  dir?: 'asc' | 'desc'
}

/** Um documento numa lista. */
export interface DocumentSummary {
  id: number
  number: string
  type: DocumentType
  state: DocumentState
  issueDate: string
  systemEntry: string
  customerTaxId: string
  customerName: string
  grossTotal: number
  netTotal: number
  taxPayable: number
  payable: number
  amountDue: number
  currency: string
  /** `VALID`, `INVALID`... (ausente na sandbox e antes da resposta da AGT). */
  agtStatus?: string
  issuedBy?: string
  /** Ex.: `API: Integração principal`. */
  issuedByName?: string
  offline: boolean
  synced: boolean
  dueDate?: string
  overdue?: boolean
}

export interface DocumentLine {
  number: number
  productCode?: string | null
  description: string
  quantity: number
  unitPrice: number
  netTotal: number
  taxTotal: number
  grossTotal: number
}

/** Um documento, com linhas, totais, valor em dívida e estado na AGT. */
export interface DocumentDetail {
  id: number
  number: string
  type: DocumentType
  state: DocumentState
  issueDate: string
  systemEntry: string
  dueDate?: string
  customerTaxId: string
  customerName: string
  customerAddress?: string
  customerEmail?: string
  customerPhone?: string
  customerCountry?: string
  netTotal: number
  taxPayable: number
  grossTotal: number
  retention: number
  payable: number
  amountDue: number
  hash: string
  hashControl: string
  offline: boolean
  syncedWithAgt: boolean
  agtStatus?: string
  agtRequestId?: string
  /** `REFUSED` quando a AGT recusou a anulação. */
  agtCancelStatus?: string | null
  lines: DocumentLine[]
  [extra: string]: unknown
}

export interface PdfOptions {
  /** `a4` (por omissão) ou `thermal` (talão de 80 mm: só FR, TV, RC e RG). */
  format?: 'a4' | 'thermal'
  /** `original` (por omissão) ou `second` (2.ª via). */
  copy?: 'original' | 'second'
}

/** O documento exportado como dados (`documents.export`). */
export interface DocumentExport {
  documentNo: string
  type: DocumentType
  sequence: number
  issueDate: string
  dueDate?: string
  systemEntry: string
  state: DocumentState
  status: string
  hash: string
  currency: string
  supplier: Record<string, string>
  customer: Record<string, string>
  totals: { net: number; tax: number; gross: number; retention: number; payable: number; settlement: number }
  paymentMethod?: string
  agt?: { status?: string; synced: boolean; offline: boolean }
  issuedBy?: string
  series?: string
  items: Array<{
    line: number
    description: string
    quantity: number
    unitPrice: number
    discount: number
    taxes: Array<{ type: string; code: string; percentage: number; base: number; amount: number; withholding: boolean }>
    net: number
    tax: number
    gross: number
  }>
  payments?: Array<{ receipt: string; amount: number; method: string; date: string; reversed: boolean }>
  creditNotes?: Array<{ issueDate: string; documentNo: string; gross: number }>
  [extra: string]: unknown
}

export interface PayDocumentRequest {
  method: PaymentMethod
  /** Sem ele, paga tudo o que falta. Até 2 casas decimais. */
  amount?: number
}

export interface PaymentResult {
  /** O recibo (`RC`); `null` quando não havia nada a pagar. */
  receipt: IssuedDocument | null
}

export interface GlobalPaymentRequest {
  /** De 1 a 100 faturas (`FT`) do mesmo cliente, sem repetir. */
  documentIds: number[]
  method: PaymentMethod
}

export interface CancelDocumentRequest {
  /** Até 500 caracteres. */
  reason: string
  /** Obrigatório numa fatura já emitida (Art. 8.º n.º 8). */
  basis?: 'emitter_identification' | 'not_sent_to_acquirer'
}

export interface RectifyDocumentRequest {
  reason: string
  /** Obrigatório num talão de venda (`TV`): quem devolve. */
  customerName?: string
  /** Obrigatório num talão de venda (`TV`): NIF de quem devolve (não `999999999`). */
  customerNif?: string
}

export interface CreditNoteRequest extends RectifyDocumentRequest {
  /** Linhas a creditar; sem `lines` credita tudo. */
  lines?: Array<{ line: number; quantity: number }>
}

export interface CreditedLine {
  line: number
  description: string
  quantity: number
  credited: number
  remaining: number
}

export interface SendDocumentRequest {
  /** Com uma chave de API, só o e-mail do cliente que consta do documento (por omissão). */
  to?: string[]
  copy?: 'original' | 'second'
}

export interface SendResult {
  queued: number
  recipients: string[]
}

export interface DocumentHistory {
  document: string
  state: DocumentState
  events: Array<{ id: number; at: string; subject: string; action: string; target: string; detail?: unknown }>
  sends: unknown[]
}

// ---------------------------------------------------------------- clientes

export interface ClientInput {
  name: string
  /** Obrigatório ao atualizar (o PUT substitui tudo). */
  taxId?: string
  clientType?: 'individual' | 'company'
  email?: string
  phone?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
  paymentTermsDays?: number
  comments?: string
}

export interface Client {
  id: number
  name: string
  taxId: string
  clientType: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  country: string
  paymentTermsDays: number
  comments: string
  active: boolean
  createdAt: string
}

export interface ListClientsParams extends PageParams {
  /** Texto a procurar no nome ou NIF. */
  q?: string
  /** Só ativos (por omissão `true`). */
  activeOnly?: boolean
}

// ---------------------------------------------------------------- produtos e catálogo

export interface ProductTaxRef {
  /** O `id` de `catalog.taxes()`. */
  taxId: number
  order: number
}

export interface ProductInput {
  name: string
  /** `product` ou `service` (obrigatório). */
  type: 'product' | 'service'
  price?: number
  unit?: string
  description?: string
  categoryId?: number
  /** Omitido: o produto fica com os impostos que tinha. `[]` tira-os. */
  taxes?: ProductTaxRef[]
  exemptionCode?: string
  retentionType?: string
  trackStock?: boolean
  minStockLevel?: number
  active?: boolean
}

export interface Product {
  code: string
  name: string
  type: string
  price: number
  unit: string
  description: string
  categoryId?: number
  taxes: ProductTaxRef[]
  exemptionCode?: string
  retentionType?: string
  trackStock: boolean
  minStockLevel: number
  active: boolean
  quantity: number
  lowStock: boolean
  createdAt: string
}

export interface ListProductsParams extends PageParams {
  q?: string
  categoryId?: number
  activeOnly?: boolean
}

export interface StockMovementRequest {
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  reason: string
}

/** O stock de um produto depois de um movimento. */
export interface StockLevel {
  code: string
  name: string
  type: string
  trackStock: boolean
  unit: string
  quantity: number
}

export interface CompanyTax {
  /** O `taxId` que os produtos usam. */
  id: number
  name: string
  code: string
  type: string
  countryRegion: string
  percentage: number
  withholding: boolean
  description: string
  system: boolean
  active: boolean
}

export interface ExemptionReason {
  code: string
  name: string
  legalBasis: string
}

export interface Category {
  id: number
  code: string
  description: string
}

// ---------------------------------------------------------------- SAF-T

export type SaftExportStatus = Open<'REQUESTED' | 'RUNNING' | 'READY' | 'FAILED'>

export interface SaftExport {
  id: number
  from: string
  to: string
  status: SaftExportStatus
  documents?: number
  sizeBytes?: number
  sha256?: string
  error?: string
  requestedBy: string
  createdAt: string
  finishedAt?: string
}

// ---------------------------------------------------------------- conta

/** `GET /api/v1/me`: com uma chave, `subject` é `apikey:<id>` e `grants` as permissões da chave. */
export interface Me {
  subject: string
  grants: Record<string, unknown>
  user?: Record<string, unknown>
}

export interface Company {
  name: string
  nif: string
  address: string
  city: string
  phone: string
  email: string
  eInvoicing: boolean
  ivaRegime: string
  establishmentNumber: string
  defaultPaymentTermsDays: number
  exemptActivity: boolean
  [extra: string]: unknown
}

// ---------------------------------------------------------------- webhooks

export type WebhookEventType = Open<
  | 'document.issued'
  | 'document.cancelled'
  | 'document.credited'
  | 'document.rectified'
  | 'document.agt.validated'
  | 'document.agt.rejected'
  | 'document.agt.cancel_rejected'
  | 'ping'
>

export interface WebhookEvent<D = Record<string, unknown>> {
  /** `evt_...`: igual em todas as repetições (use-o para ignorar duplicados). */
  id: string
  type: WebhookEventType
  createdAt: string
  /** A empresa (na sandbox, o identificador da sandbox). */
  tenant: string
  data: D
}

/** O `data` de `document.issued`. */
export interface DocumentIssuedData {
  documentId: number
  documentNo: string
  documentType: DocumentType
  customerTaxId: string
  grossTotal: string
}

// ---------------------------------------------------------------- erros

/** Documento de erro RFC 9457. */
export interface Problem {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  field?: string
  errors?: Record<string, string>
  metric?: string
  limit?: number
  [extra: string]: unknown
}
