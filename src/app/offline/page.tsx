import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline' };

/**
 * Shown by the service worker when a page is asked for and there is no network.
 *
 * It says nothing about stations on purpose. A cached board would be a lie:
 * every fact on it — whether a charger is connected, whether a session is
 * running — is only true while the connection is.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">No connection</h1>
      <p className="text-muted-foreground text-sm">
        The console needs the network to tell you anything true about a charger.
        Nothing here is cached, so there is nothing to show until you are back
        online.
      </p>
    </main>
  );
}
