import type { Metadata } from 'next';
import { WebhooksBoard } from './webhooks-board';

export const metadata: Metadata = { title: 'Webhooks' };

export default function WebhooksPage() {
  return <WebhooksBoard />;
}
