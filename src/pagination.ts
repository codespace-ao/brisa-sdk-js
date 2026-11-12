import type { Page, PageParams } from './types.js'

/**
 * Percorre todas as páginas de uma lista, pedindo a seguinte só quando é precisa.
 *
 * ```ts
 * for await (const doc of brisa.documents.listAll({ type: 'FT' })) console.log(doc.number)
 * ```
 */
export async function* paginate<T, P extends PageParams>(fetchPage: (params: P) => Promise<Page<T>>, params: P): AsyncGenerator<T, void, undefined> {
  let page = params.page ?? 0
  const size = params.size ?? 100
  let seen = 0
  for (;;) {
    const p = await fetchPage({ ...params, page, size })
    for (const item of p.items) yield item
    seen += p.items.length
    if (p.items.length === 0 || p.items.length < p.size || seen + (params.page ?? 0) * size >= p.total) return
    page++
  }
}

/** Junta numa lista todos os itens de um iterador assíncrono (cuidado com listas muito grandes). */
export async function collect<T>(it: AsyncIterable<T>, max = Number.POSITIVE_INFINITY): Promise<T[]> {
  const out: T[] = []
  for await (const x of it) {
    out.push(x)
    if (out.length >= max) break
  }
  return out
}
