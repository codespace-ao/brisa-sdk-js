# Impressão

O mesmo documento sai em quatro papéis. Escolhe-se no pedido do PDF.

| `format` | Papel | Para |
|---|---|---|
| `a4` (por omissão) | folha A4 | qualquer documento |
| `a5` | meia folha | o A4 reduzido, para papel mais pequeno |
| `thermal80` (ou `thermal`) | rolo de 80 mm | talões de `FR`, `TV`, `RC` e `RG` |
| `thermal58` | rolo de 58 mm | idem, em impressoras pequenas |

```bash
curl "https://api.brisa.ao/api/v1/documents/ID/pdf?format=a5" -H "Authorization: Bearer $BRISA_API_KEY" -o fatura-a5.pdf
```

```ts
const a4  = await brisa.documents.pdf(id)
const a5  = await brisa.documents.pdf(id, { format: 'a5' })
const r80 = await brisa.documents.pdf(fr.id, { format: 'thermal80' })
const r58 = await brisa.documents.pdf(fr.id, { format: 'thermal58' })
```

```php
$a5  = $brisa->documents->pdf($id, ['format' => 'a5']);
$r80 = $brisa->documents->pdf($fr['id'], ['format' => 'thermal80']);
```

## Original e 2.ª via

`copy=second` imprime a 2.ª via, que diz que o é e quando foi impressa de novo.

```ts
await brisa.documents.pdf(id, { copy: 'second' })
```

> **Nota:** os rolos só existem para vendas e recibos. Pedir `thermal80` para uma `FT` devolve `422`.

## Na aplicação Brisa

Em *Definições → Impressão* cada pessoa escolhe o papel predefinido (A4, A5 ou rolo), dá um nome à impressora do aparelho e pode pedir que o talão saia logo depois de uma venda no POS. O navegador não deixa uma página escolher a impressora por código: escolhe-se uma vez no diálogo do sistema, que se lembra.

## Próximos passos

[Dados bancários nas faturas](06-dados-bancarios.md)
