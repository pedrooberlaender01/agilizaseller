import { redirect } from 'next/navigation'

export default async function ShopeeAdsPageLegacy({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const sp = await searchParams
  const qs = sp.period ? `?tab=ads&period=${encodeURIComponent(sp.period)}` : '?tab=ads'
  redirect(`/shopee/anuncios${qs}`)
}
