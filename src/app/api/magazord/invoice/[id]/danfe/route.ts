import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Variant = 'danfe' | 'danfeSimplificada' | 'etiqueta'

function pickVariant(raw: string | null): Variant {
  if (raw === 'simplificada') return 'danfeSimplificada'
  if (raw === 'etiqueta') return 'etiqueta'
  return 'danfe'
}

function endpointPath(variant: Variant): string {
  if (variant === 'etiqueta') return 'etiquetaTransporte/pdf'
  return `${variant}/pdf`
}

function filenamePrefix(variant: Variant): string {
  if (variant === 'etiqueta') return 'Etiqueta'
  if (variant === 'danfeSimplificada') return 'DANFE-Simples'
  return 'DANFE'
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const variant = pickVariant(req.nextUrl.searchParams.get('variant'))

  const supabase = await createClient()
  const { data: inv, error } = await supabase
    .from('mag_invoices')
    .select('identificador, numero, connection_id')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!inv?.identificador) return NextResponse.json({ error: 'NF não encontrada' }, { status: 404 })

  const baseUrl = process.env.MAGAZORD_BASE_URL ?? 'https://luzzoo.painel.magazord.com.br'
  const auth = process.env.MAGAZORD_AUTH_HEADER
  if (!auth) {
    return NextResponse.json(
      { error: 'MAGAZORD_AUTH_HEADER não configurado em .env.local' },
      { status: 500 },
    )
  }

  const upstream = await fetch(
    `${baseUrl}/api/v2/faturamento/notaFiscal/${inv.identificador}/${endpointPath(variant)}`,
    { headers: { Authorization: auth, Accept: 'application/json' } },
  )

  if (!upstream.ok) {
    const text = await upstream.text()
    return NextResponse.json(
      { error: 'Magazord upstream error', status: upstream.status, detail: text.slice(0, 300) },
      { status: upstream.status },
    )
  }

  const json = (await upstream.json()) as { data?: { documento?: string } }
  const b64 = json?.data?.documento
  if (!b64) {
    return NextResponse.json({ error: 'Campo documento ausente na resposta' }, { status: 502 })
  }

  const buf = Buffer.from(b64, 'base64')
  if (buf.length < 4 || buf.toString('ascii', 0, 4) !== '%PDF') {
    return NextResponse.json({ error: 'Documento decodificado não é PDF válido' }, { status: 502 })
  }

  const filename = `${filenamePrefix(variant)}-${inv.numero ?? inv.identificador}.pdf`
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
