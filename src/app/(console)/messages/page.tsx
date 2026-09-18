import type { Metadata } from 'next';
import { MessagesBoard } from './messages-board';

export const metadata: Metadata = { title: 'Messages' };

export default function MessagesPage() {
  return <MessagesBoard />;
}
