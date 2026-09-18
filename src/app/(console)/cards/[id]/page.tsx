import type { Metadata } from 'next';
import { CardDetail } from './card-detail';

export const metadata: Metadata = { title: 'Card' };

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CardDetail id={id} />;
}
