'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
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
import type { Tariff } from '@/lib/api/types';
import { definitionOf, NEW_EDITOR, type RoundingMode } from './definition';
import { DefinitionEditor } from './definition-editor';

/**
 * A new tariff and its first version, in force from now.
 *
 * The currency cannot be changed afterwards and neither can a version, so both
 * are stated here rather than left to be corrected later: a price change is a
 * new version, and a tariff in the wrong currency is a new tariff.
 */
export function CreateTariffDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [rounding, setRounding] = useState<RoundingMode>('half_up');
  const [editor, setEditor] = useState(NEW_EDITOR);
  const queryClient = useQueryClient();
  const router = useRouter();

  const create = useMutation({
    mutationFn: () => {
      const built = definitionOf(editor);
      if ('error' in built) throw new Error(built.error);
      return apiSend<Tariff>('POST', '/tariffs', {
        name: name.trim(),
        currency: currency.trim().toUpperCase(),
        rounding,
        definition: built.definition,
      });
    },
    onSuccess: (tariff) => {
      void queryClient.invalidateQueries({ queryKey: ['tariffs'] });
      setOpen(false);
      setName('');
      setEditor(NEW_EDITOR);
      toast.success(`${tariff.name} created.`);
      router.push(`/tariffs/${tariff.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>New tariff</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New tariff</DialogTitle>
          <DialogDescription>
            Its first version takes effect immediately. Attach it to a site or a
            charger from that site’s or charger’s page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tariff-name">Name</Label>
            <Input
              id="tariff-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Public AC, daytime"
              maxLength={120}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="tariff-currency">Currency</Label>
              <Input
                id="tariff-currency"
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
                placeholder="INR"
                maxLength={3}
                spellCheck={false}
                className="w-24"
              />
              <p className="text-muted-foreground text-xs">
                ISO 4217. Every amount below is in its minor units, and this
                cannot be changed later.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tariff-rounding">Rounding</Label>
              <Select
                value={rounding}
                onValueChange={(value) =>
                  setRounding((value as RoundingMode | null) ?? 'half_up')
                }
              >
                <SelectTrigger id="tariff-rounding">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="half_up">half up</SelectItem>
                  <SelectItem value="half_even">half even</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                How each cost line is rounded to a whole minor unit.
              </p>
            </div>
          </div>

          <DefinitionEditor
            state={editor}
            onChange={setEditor}
            currency={currency.trim().toUpperCase() || 'INR'}
          />
        </div>

        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={
              name.trim().length === 0 ||
              currency.trim().length !== 3 ||
              create.isPending
            }
          >
            {create.isPending ? 'Creating…' : 'Create tariff'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
