import type { Metadata } from 'next';
import { PaymentDetail } from './payment-detail';

export const metadata: Metadata = { title: 'Payment' };

export default async function DriverPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaymentDetail id={id} />;
}
