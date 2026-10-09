import type { Metadata } from 'next';
import { BackButton } from '@/components/back-button';
import { SiteLoad } from './site-load';

export const metadata: Metadata = { title: 'Site' };

export default async function SitePage({ params }: PageProps<'/sites/[id]'>) {
  const { id } = await params;
  return (
    <>
      <BackButton fallback="/sites" />
      <SiteLoad id={id} />
    </>
  );
}
