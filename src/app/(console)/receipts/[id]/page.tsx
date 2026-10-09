import type { Metadata } from 'next';
import { BackButton } from '@/components/back-button';
import { ReceiptDetail } from './receipt-detail';

export const metadata: Metadata = { title: 'Receipt' };

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <BackButton fallback="/receipts" />
      <ReceiptDetail id={id} />
    </>
  );
}
