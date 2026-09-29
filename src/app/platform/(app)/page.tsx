import { redirect } from 'next/navigation';

/** Tenants are the whole of the platform console, for now. */
export default function PlatformHomePage() {
  redirect('/platform/tenants');
}
