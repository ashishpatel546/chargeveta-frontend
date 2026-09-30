import type { Metadata } from 'next';
import { NotificationsView } from './notifications-view';

export const metadata: Metadata = { title: 'Notifications' };

export default function DriverNotificationsPage() {
  return <NotificationsView />;
}
