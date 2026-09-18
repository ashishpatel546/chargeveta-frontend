import type { Metadata } from 'next';
import { UsersBoard } from './users-board';

export const metadata: Metadata = { title: 'People' };

export default function UsersPage() {
  return <UsersBoard />;
}
