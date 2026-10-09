import type { Metadata } from 'next';
import { BackButton } from '@/components/back-button';
import { SessionDetail } from './session-detail';

export const metadata: Metadata = { title: 'Session' };

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <BackButton fallback="/sessions" />
      <SessionDetail id={id} />
    </>
  );
}
