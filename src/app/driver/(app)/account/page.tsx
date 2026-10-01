import type { Metadata } from 'next';
import { AccountView } from '../account-view';

export const metadata: Metadata = { title: 'Account' };

/** The driver's own account; `/driver` itself is the home screen. */
export default function DriverAccountPage() {
  return <AccountView />;
}
