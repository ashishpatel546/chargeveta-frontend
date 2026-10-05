import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Instrument_Sans } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/query-provider';
import { ServiceWorker } from '@/components/service-worker';
import { config } from '@/lib/config';
import './globals.css';

/**
 * One family for everything. Its width axis is the point: body text sits at
 * normal width, and every live reading (kWh, ₹, kW, %) is set condensed by the
 * `readout` utility in `globals.css`, the way a meter's dial reads.
 */
const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
  axes: ['wdth'],
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
    { media: '(prefers-color-scheme: light)', color: '#f5f6fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1433' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}
      // next-themes sets the `dark` class before React hydrates.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>{children}</QueryProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
