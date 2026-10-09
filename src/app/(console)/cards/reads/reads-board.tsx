'use client';

import { FilterCombobox } from '@/components/filter-combobox';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet } from '@/lib/api/client';
import type { Station } from '@/lib/api/types';
import {
  AuthorizationTable,
  DECISION_FILTERS,
  useAuthorizations,
  type AuthorizationFilters,
} from '../authorizations';

/**
 * Which cards to ask about.
 *
 * "Unreadable" is a filter of its own rather than an empty box: a charger that
 * could not read a card at all reports an empty identifier, and the API takes
 * `?token=` for exactly those. An empty box has to mean "every card", so the
 * two cannot be the same control.
 */
type TokenMode = 'any' | 'exact' | 'unreadable';

interface Applied {
  mode: TokenMode;
  token: string;
}

export function ReadsBoard() {
  const [mode, setMode] = useState<TokenMode>('any');
  const [draft, setDraft] = useState('');
  const [applied, setApplied] = useState<Applied>({ mode: 'any', token: '' });
  const [stationId, setStationId] = useState('all');
  const [status, setStatus] = useState('all');

  const stations = useQuery({
    queryKey: ['stations'],
    queryFn: () => apiGet<Station[]>('/stations'),
  });

  const filters: AuthorizationFilters = {
    token:
      applied.mode === 'unreadable'
        ? ''
        : applied.mode === 'exact' && applied.token !== ''
          ? applied.token
          : undefined,
    stationId: stationId === 'all' ? undefined : stationId,
    status: status === 'all' ? undefined : status,
  };

  const reads = useAuthorizations('/authorizations', filters);

  return (
    <>
      <PageHeader
        title="Card reads"
        description="Every identifier presented at a charger in this operator, and what the platform answered."
      >
        <Button
          variant="outline"
          render={<Link href="/cards" />}
          nativeButton={false}
        >
          Back to cards
        </Button>
      </PageHeader>

      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ mode, token: draft.trim() });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="token-mode">Card</Label>
          <FilterCombobox
            id="token-mode"
            value={mode}
            onChange={(value) => {
              // "Any card" and "could not be read" need nothing typed, so they
              // take effect at once; only a token has to be finished first.
              const next = value as TokenMode;
              setMode(next);
              setApplied({ mode: next, token: draft.trim() });
            }}
            items={[
              { value: 'any', label: 'Any card' },
              { value: 'exact', label: 'This token' },
              { value: 'unreadable', label: 'Could not be read' },
            ]}
            allValue="any"
            label="Card"
            className="w-48"
          />
        </div>

        {mode === 'exact' ? (
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="A1B2C3D4"
              spellCheck={false}
              className="w-56"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="station">Charger</Label>
          <FilterCombobox
            id="station"
            value={stationId}
            onChange={setStationId}
            items={[
              { value: 'all', label: 'Every charger' },
              ...[...(stations.data ?? [])]
                .sort((a, b) => a.identity.localeCompare(b.identity))
                .map((station) => ({
                  value: station.id,
                  label: station.identity,
                })),
            ]}
            label="Charger"
            className="w-52"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="result">Result</Label>
          <FilterCombobox
            id="result"
            value={status}
            onChange={setStatus}
            items={DECISION_FILTERS}
            label="Result"
            className="w-48"
          />
        </div>

        {mode === 'exact' ? (
          <Button type="submit" variant="outline">
            Search
          </Button>
        ) : null}
      </form>

      <p className="text-muted-foreground mb-4 text-sm">
        A token is matched without regard to case, and need not be a card on the
        list — a card turned away as Unknown is usually the one being asked
        about.
      </p>

      <AuthorizationTable
        query={reads}
        showCard
        empty="No card read matches that."
      />
    </>
  );
}
