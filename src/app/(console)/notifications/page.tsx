import type { Metadata } from 'next';
import { NotificationsBoard } from './notifications-board';

export const metadata: Metadata = { title: 'Alerts' };

export default function NotificationsPage() {
  return <NotificationsBoard />;
}
