import type { Metadata } from 'next';
import { PlatformAuditView } from './audit-view';

export const metadata: Metadata = { title: 'Audit log' };

export default function PlatformAuditPage() {
  return <PlatformAuditView />;
}
