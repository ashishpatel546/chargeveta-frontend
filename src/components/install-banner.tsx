'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  ShareIcon,
  SquarePlusIcon,
  XIcon,
} from 'lucide-react';
import { BrandMark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';

/** How long after the page opens the banner appears. */
const SHOW_AFTER_MS = 3_000;
/** How long a dismissal is honoured before the banner may ask again. */
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'cv.driver.installBanner.dismissedAt';

/** Pages under `/driver` that have no bottom tab bar to sit above. */
const PUBLIC_PREFIXES = ['/driver/sign-in', '/driver/register', '/driver/link'];

/**
 * Chromium's install event. Not in the DOM lib types because it never became
 * a standard — Safari and Firefox do not fire it.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android';

function detectPlatform(): Platform | null {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return null;
}

function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own flag for a home-screen launch.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function rememberDismissal(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Private window or blocked storage: it asks again next visit, nothing else.
  }
}

/**
 * "Install the app" banner for the driver PWA, on Android and iPhone/iPad
 * only — the console is a desktop tool and the driver app is the one meant to
 * live on a home screen.
 *
 * Android Chromium hands over a real install prompt (`beforeinstallprompt`),
 * so there it is one button; when the browser withholds that event (Firefox,
 * some Samsung Internet builds, or Chrome before it decides the page is
 * installable) it falls back to the menu instructions. iOS has no install API
 * at all, so there it is always the Share → Add to Home Screen steps.
 *
 * Never shown when already running installed, and closing it — or declining
 * the browser's own prompt — keeps it away for a day (`localStorage`, so per
 * device and browser).
 */
export function InstallBanner() {
  const pathname = usePathname();
  // Null until the delay has passed — and again once closed or installed.
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const detected = detectPlatform();
    if (!detected || isInstalled() || recentlyDismissed()) return;
    const onBeforeInstall = (event: Event) => {
      // Keep Chrome's own mini-infobar out of the way; ours replaces it.
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPlatform(null);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    const timer = window.setTimeout(
      () => setPlatform(detected),
      SHOW_AFTER_MS,
    );

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!platform) return null;

  const dismiss = () => {
    rememberDismissal();
    setPlatform(null);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // The event is single-use either way.
    setInstallEvent(null);
    if (outcome === 'accepted') setPlatform(null);
    else dismiss();
  };

  const hasTabBar = !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <div
      role="dialog"
      aria-labelledby="install-banner-title"
      className={cn(
        'fixed inset-x-0 z-50 mx-auto w-full max-w-md px-3',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
        hasTabBar ? 'bottom-20' : 'bottom-4',
      )}
    >
      <div className="bg-background relative rounded-xl border p-4 pr-10 shadow-lg">
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2"
          aria-label="Close"
          onClick={dismiss}
        >
          <XIcon />
        </Button>

        <div className="flex items-start gap-3">
          <BrandMark className="size-10 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p id="install-banner-title" className="font-semibold">
              Install {config.appName}
            </p>
            <p className="text-muted-foreground text-sm">
              Add it to your home screen for one-tap access and charging
              alerts.
            </p>
          </div>
        </div>

        {platform === 'android' && installEvent ? (
          <Button className="mt-3 w-full" size="lg" onClick={install}>
            <DownloadIcon />
            Install app
          </Button>
        ) : platform === 'android' ? (
          <ol className="mt-3 space-y-2 text-sm">
            <Step n={1}>
              Tap the browser menu{' '}
              <EllipsisVerticalIcon className="inline size-4 align-text-bottom" />{' '}
              (top-right)
            </Step>
            <Step n={2}>
              Choose <strong>Install app</strong> or{' '}
              <strong>Add to Home screen</strong>
            </Step>
          </ol>
        ) : (
          <ol className="mt-3 space-y-2 text-sm">
            <Step n={1}>
              Tap the Share button{' '}
              <ShareIcon className="inline size-4 align-text-bottom" /> in the
              browser toolbar
            </Step>
            <Step n={2}>
              Scroll down and tap <strong>Add to Home Screen</strong>{' '}
              <SquarePlusIcon className="inline size-4 align-text-bottom" />
            </Step>
            <Step n={3}>
              Tap <strong>Add</strong> in the top-right corner
            </Step>
          </ol>
        )}
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
