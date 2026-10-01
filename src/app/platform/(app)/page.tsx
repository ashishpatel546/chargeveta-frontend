import { redirect } from 'next/navigation';

/**
 * The platform console opens on its dashboard (doc 6 §19.5), as the staff
 * console opens on its own (§20.4).
 */
export default function PlatformHomePage() {
  redirect('/platform/dashboard');
}
