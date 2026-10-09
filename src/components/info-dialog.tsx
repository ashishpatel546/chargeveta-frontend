'use client';

import { InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * An "i" beside a term, opening the long explanation of it.
 *
 * The short version of a term belongs in the hint under the field, where it is
 * read without a click. This is for what does not fit there — the worked
 * example, the table, the "on a 1.6 charger…" — so a screen can explain itself
 * fully without every form becoming a page of prose.
 *
 * It opens fine from inside another dialog (Base UI nests them), which is where
 * most of the fields it explains live.
 */
export function InfoDialog({
  title,
  summary,
  children,
  label,
  text,
}: {
  title: string;
  /** One line under the title. */
  summary?: React.ReactNode;
  children: React.ReactNode;
  /** The accessible name of the button; defaults to "About <title>". */
  label?: string;
  /** Shown beside the icon, for a page-level guide rather than one term. */
  text?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          text ? (
            <Button type="button" variant="outline" />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={label ?? `About ${title.toLowerCase()}`}
              className="text-muted-foreground hover:text-foreground align-middle"
            />
          )
        }
      >
        <InfoIcon />
        {text}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {summary ? <DialogDescription>{summary}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed [&_h3]:pt-1 [&_h3]:font-medium [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
