'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiSend } from '@/lib/api/client';
import type { Tariff, TariffVersion } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import {
  definitionOf,
  editorFrom,
  NEW_EDITOR,
  type RoundingMode,
} from '../definition';
import { DefinitionEditor } from '../definition-editor';

/**
 * A price change, as a new version.
 *
 * The prices start as a copy of the newest version, because a change is nearly
 * always a change to one part of it rather than a fresh definition. `validFrom`
 * may be left empty for "now" or set later — a rise can be scheduled — but
 * never earlier than the newest version, since that would change which version
 * priced sessions that have already been billed.
 */
export function NewVersionDialog({
  tariff,
  latest,
}: {
  tariff: Tariff;
  /** The newest version by `validFrom`, whether or not it is in force yet. */
  latest: TariffVersion | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [validFrom, setValidFrom] = useState('');
  const [rounding, setRounding] = useState<RoundingMode>(
    (latest?.rounding as RoundingMode | undefined) ?? 'half_up',
  );
  const [editor, setEditor] = useState(
    latest ? editorFrom(latest.definition) : NEW_EDITOR,
  );
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () => {
      const built = definitionOf(editor);
      if ('error' in built) throw new Error(built.error);

      let instant: string | undefined;
      if (validFrom !== '') {
        const at = new Date(validFrom);
        if (Number.isNaN(at.getTime())) {
          throw new Error('That is not a date and time');
        }
        if (at.getTime() <= Date.now()) {
          throw new Error(
            'A version takes effect now or later, never in the past',
          );
        }
        if (latest && at.getTime() <= new Date(latest.validFrom).getTime()) {
          throw new Error(
            `Later than version ${latest.version}, which starts ${dateTime(latest.validFrom)}`,
          );
        }
        instant = at.toISOString();
      } else if (latest && new Date(latest.validFrom).getTime() > Date.now()) {
        throw new Error(
          `Version ${latest.version} is scheduled for ${dateTime(latest.validFrom)}. Give this one a later time.`,
        );
      }

      return apiSend<Tariff>('POST', `/tariffs/${tariff.id}/versions`, {
        ...(instant ? { validFrom: instant } : {}),
        rounding,
        definition: built.definition,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tariff', tariff.id] });
      void queryClient.invalidateQueries({ queryKey: ['tariffs'] });
      setOpen(false);
      setValidFrom('');
      toast.success('New version added.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setEditor(latest ? editorFrom(latest.definition) : NEW_EDITOR);
          setValidFrom('');
        }
      }}
    >
      <DialogTrigger render={<Button />}>New version</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New version of {tariff.name}</DialogTitle>
          <DialogDescription>
            Sessions that have already run keep the version that priced them.
            Versions are never edited or removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid-from">In force from</Label>
              <Input
                id="valid-from"
                type="datetime-local"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
                className="w-56"
              />
              <p className="text-muted-foreground text-xs">
                Leave empty to start now. A later time schedules the change;{' '}
                {latest
                  ? `it has to be after ${dateTime(latest.validFrom)}, when version ${latest.version} starts.`
                  : 'an earlier one is refused.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version-rounding">Rounding</Label>
              <Select
                value={rounding}
                onValueChange={(value) =>
                  setRounding((value as RoundingMode | null) ?? 'half_up')
                }
              >
                <SelectTrigger id="version-rounding">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="half_up">half up</SelectItem>
                  <SelectItem value="half_even">half even</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DefinitionEditor
            state={editor}
            onChange={setEditor}
            currency={tariff.currency}
          />
        </div>

        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
