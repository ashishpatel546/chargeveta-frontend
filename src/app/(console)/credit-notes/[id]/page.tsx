import type { Metadata } from 'next';
import { BackButton } from '@/components/back-button';
import { CreditNoteDetail } from './credit-note-detail';

export const metadata: Metadata = { title: 'Credit note' };

export default async function CreditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <BackButton fallback="/credit-notes" />
      <CreditNoteDetail id={id} />
    </>
  );
}
