import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/query-provider';
import { ServiceWorker } from '@/components/service-worker';
import { config } from '@/lib/config';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: `${config.appName} console`,
    template: `%s · ${config.appName}`,
  },
  description: 'Operate charging stations, sessions, tariffs and receipts.',
  applicationName: config.appName,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: config.appName },
  // Nothing here should ever be indexed: every page needs a session, and the
  // ones that do not are sign-in pages.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <QueryProvider>{children}</QueryProvider>
        <Toaster richColors position="top-right" />
        <ServiceWorker />
      </body>
    </html>
  );
}
