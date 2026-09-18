import type { Metadata } from 'next';
import { SessionDetail } from './session-detail';

export const metadata: Metadata = { title: 'Session' };

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionDetail id={id} />;
}
