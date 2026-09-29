import type { Metadata } from 'next';
import { TenantAuditView } from './audit-view';

export const metadata: Metadata = { title: 'Audit log' };

export default function AuditPage() {
  return <TenantAuditView />;
}
