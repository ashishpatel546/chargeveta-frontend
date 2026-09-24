import type { Metadata } from 'next';
import { WalletView } from './wallet-view';

export const metadata: Metadata = { title: 'Wallet' };

export default function DriverWalletPage() {
  return <WalletView />;
}
