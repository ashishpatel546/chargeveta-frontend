'use client';

import { useQuery } from '@tanstack/react-query';
import { CreateWebhookDialog } from './create-webhook-dialog';
import { WebhookCard } from './webhook-card';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { apiGet } from '@/lib/api/client';
import type { WebhookEndpoint } from '@/lib/api/types';

export function WebhooksBoard() {
  const canAdmin = useCan('admin');

  const endpoints = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: () => apiGet<WebhookEndpoint[]>('/webhook-endpoints'),
  });

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Where alerts are posted as they are raised, for a system that should react without anyone watching this console."
      >
        {canAdmin ? <CreateWebhookDialog /> : null}
      </PageHeader>

      <VerificationNotes />

      {endpoints.isPending ? <Loading rows={3} /> : null}
      {endpoints.isError ? <Failed error={endpoints.error} /> : null}
      {endpoints.isSuccess && endpoints.data.length === 0 ? (
        <Empty>No endpoints yet.</Empty>
      ) : null}

      {endpoints.isSuccess && endpoints.data.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {endpoints.data.map((endpoint) => (
            <WebhookCard key={endpoint.id} endpoint={endpoint} />
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * How a receiver tells a real delivery from anything else.
 *
 * Written on the page rather than in a document somewhere, because whoever is
 * adding the endpoint is the person who has to implement this, and they are
 * here.
 */
function VerificationNotes() {
  return (
    <div className="text-muted-foreground mb-4 space-y-2 rounded-md border p-3 text-sm">
      <p>Every delivery is a POST carrying three headers:</p>
      <ul className="ml-4 list-disc space-y-1">
        <li>
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
            ChargeVeta-Signature: t=&lt;unix seconds&gt;,v1=&lt;hex&gt;
          </code>{' '}
          — <code>v1</code> is an HMAC-SHA256 of the string{' '}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
            &lt;t&gt;.&lt;raw body&gt;
          </code>
          , keyed with this endpoint&rsquo;s secret.
        </li>
        <li>
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
            ChargeVeta-Delivery
          </code>{' '}
          — the delivery&rsquo;s id, the same across retries, so a receiver can
          ignore one it has already handled.
        </li>
        <li>
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
            ChargeVeta-Event
          </code>{' '}
          — the kind of alert, for routing without parsing the body.
        </li>
      </ul>
      <p>
        Verify against the bytes as they arrived: re-serialising the JSON
        changes them and the signature will not match. Compare the hex with a
        constant-time comparison, and refuse a <code>t</code> that is not within
        a few minutes of now.
      </p>
    </div>
  );
}
