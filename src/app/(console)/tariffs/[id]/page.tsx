import type { Metadata } from 'next';
import { TariffDetail } from './tariff-detail';

export const metadata: Metadata = { title: 'Tariff' };

export default async function TariffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TariffDetail id={id} />;
}
