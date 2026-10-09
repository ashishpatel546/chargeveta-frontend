import type { Metadata } from 'next';
import { BackButton } from '@/components/back-button';
import { TariffDetail } from './tariff-detail';

export const metadata: Metadata = { title: 'Tariff' };

export default async function TariffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <BackButton fallback="/tariffs" />
      <TariffDetail id={id} />
    </>
  );
}
