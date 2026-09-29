import type { Metadata } from 'next';
import { AttentionBoard } from './attention-board';

export const metadata: Metadata = { title: 'Payments' };

export default function PaymentsPage() {
  return <AttentionBoard />;
}
