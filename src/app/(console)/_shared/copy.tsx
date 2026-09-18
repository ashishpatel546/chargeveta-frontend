'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Copying a value the reader cannot retype.
 *
 * The clipboard is refused outright in an insecure context and by some
 * policies, so a failure has to say what to do instead rather than leave the
 * button looking broken.
 */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => setCopied(true))
          .catch(() =>
            toast.error(
              'The browser would not give access to the clipboard. Select the value and copy it by hand.',
            ),
          );
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

/**
 * A secret the API returns exactly once.
 *
 * API keys, webhook secrets and setup tokens are hashed on the server the
 * moment they are made, so this panel is the only place the plain value will
 * ever exist. It is deliberately loud, and nothing about it is persisted —
 * closing the dialog loses the value for good.
 */
export function SecretOnce({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-amber-600/40 bg-amber-600/5 p-3">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
        {title}
      </p>
      <p className="text-muted-foreground text-xs">
        This is the only time it is shown. It is not stored anywhere you can
        read it back, and closing this loses it — you would have to make a new
        one.
      </p>
      <div className="flex items-start gap-2">
        <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded px-2 py-1 font-mono text-xs break-all">
          {value}
        </code>
        <CopyButton value={value} />
      </div>
      {note ? <div className="text-muted-foreground text-xs">{note}</div> : null}
    </div>
  );
}
