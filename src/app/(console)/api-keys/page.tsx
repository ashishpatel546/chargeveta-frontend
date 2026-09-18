import type { Metadata } from 'next';
import { ApiKeysBoard } from './api-keys-board';

export const metadata: Metadata = { title: 'API keys' };

export default function ApiKeysPage() {
  return <ApiKeysBoard />;
}
