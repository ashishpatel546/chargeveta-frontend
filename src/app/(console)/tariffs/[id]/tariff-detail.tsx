'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiGet } from '@/lib/api/client';
import type { Tariff, TariffVersion } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { DefinitionView, JsonBlock } from '../definition-view';
import { NewVersionDialog } from './new-version-dialog';
import { RenameTariffDialog } from './rename-tariff-dialog';

/**
 * One tariff and every version it has had.
 *
 * The history is the screen, not a footnote: a session is priced by the version
 * that was in force when it ran, so reading a bill back means reading the
 * version beside it.
 */
export function TariffDetail({ id }: { id: string }) {
  const canAdmin = useCan('admin');

  const tariff = useQuery({
    queryKey: ['tariff', id],
    queryFn: () => apiGet<Tariff>(`/tariffs/${id}`),
  });

  if (tariff.isPending) return <Loading />;
  if (tariff.isError) return <Failed error={tariff.error} />;

  const versions = tariff.data.versions ?? [];
  // `versions` arrives newest first, so the newest is the one a new version
  // has to start after, and everything above the version in force is still
  // scheduled. Reading it from the order rather than from the clock keeps this
  // the API's judgement of "in force" and not a second one made here.
  const latest = versions[0];
  const currentIndex = versions.findIndex(
    (version) => version.id === tariff.data.currentVersion?.id,
  );

  return (
    <>
      <PageHeader
        title={tariff.data.name}
        description={`${tariff.data.currency} · ${versions.length} version${versions.length === 1 ? '' : 's'} · created ${dateTime(tariff.data.createdAt)}`}
      >
        {canAdmin ? (
          <>
            <RenameTariffDialog tariff={tariff.data} />
            <NewVersionDialog tariff={tariff.data} latest={latest} />
          </>
        ) : null}
      </PageHeader>

      {versions.length === 0 ? (
        <Empty>This tariff has no versions.</Empty>
      ) : (
        <div className="space-y-3">
          {versions.map((version, index) => (
            <VersionCard
              key={version.id}
              version={version}
              currency={tariff.data.currency}
              standing={standingOf(index, currentIndex)}
            />
          ))}
        </div>
      )}
    </>
  );
}

type Standing = 'in force' | 'scheduled' | 'superseded';

/** Where a version sits, given which one the API says is in force. */
function standingOf(index: number, currentIndex: number): Standing {
  if (index === currentIndex) return 'in force';
  // No version is in force yet, or this one is above it: it starts later.
  return currentIndex === -1 || index < currentIndex
    ? 'scheduled'
    : 'superseded';
}

function VersionCard({
  version,
  currency,
  standing,
}: {
  version: TariffVersion;
  currency: string;
  standing: Standing;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          Version {version.version}
          <span className="text-muted-foreground ml-2 font-normal">
            from {dateTime(version.validFrom)}
          </span>
        </CardTitle>
        <div className="flex gap-1">
          {standing === 'in force' ? <Badge>in force</Badge> : null}
          {standing === 'scheduled' ? (
            <Badge variant="secondary">scheduled</Badge>
          ) : null}
          {standing === 'superseded' ? (
            <Badge variant="outline">superseded</Badge>
          ) : null}
          <Badge variant="outline">{version.rounding}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <DefinitionView definition={version.definition} currency={currency} />
        <JsonBlock label="Definition as stored" value={version.definition} />
      </CardContent>
    </Card>
  );
}
