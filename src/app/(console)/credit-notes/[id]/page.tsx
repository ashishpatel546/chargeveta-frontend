import type { Metadata } from 'next';
import { CreditNoteDetail } from './credit-note-detail';

export const metadata: Metadata = { title: 'Credit note' };

export default async function CreditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreditNoteDetail id={id} />;
}
