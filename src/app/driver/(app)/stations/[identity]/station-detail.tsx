'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDriver } from '@/components/driver-context';
import { Failed, Loading } from '@/components/driver-query-state';
import { PageHeader } from '@/components/page-header';
import { ConnectorBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { driverApiGet, driverApiSend } from '@/lib/api/driver-client';
import type {
  CheckoutDto,
  DriverCardDto,
  DriverCommandResultDto,
  DriverConnectorDto,
  DriverStationDto,
  HoldConfirmedDto,
  WalletDto,
} from '@/lib/api/driver-types';
import { money } from '@/lib/format';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';
import { QuoteCard } from './quote-card';

/**
 * A charger by its identity (doc 6 §22.3) — what a QR code on it carries, or
 * `StationsView`'s "Find" box. Starting sends `evseId` on 2.x, `connectorId`
 * on 1.6, exactly as `StartChargingDto` splits it.
 */
export function StationDetail({ identity }: { identity: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const station = useQuery({
    queryKey: ['driver', 'station', identity],
    queryFn: () => driverApiGet<DriverStationDto>(`/driver/stations/${identity}`),
  });

  const cards = useQuery({
    queryKey: ['driver', 'cards'],
    queryFn: () => driverApiGet<DriverCardDto[]>('/driver/cards'),
  });

  const wallet = useQuery({
    queryKey: ['driver', 'wallet'],
    queryFn: () => driverApiGet<WalletDto>('/driver/wallet'),
  });

  const driver = useDriver();

  const [connectorKey, setConnectorKey] = useState<string | undefined>(undefined);
  const [cardId, setCardId] = useState<string | undefined>(undefined);

  function resolveConnector(): DriverConnectorDto {
    const data = station.data!;
    const connector = data.connectors.find(
      (c) => connectorOf(c) === (connectorKey ?? connectorOf(data.connectors[0])),
    );
    if (!connector) throw new Error('Choose a connector first.');
    return connector;
  }

  function reportCommand(result: DriverCommandResultDto) {
    if (result.outcome === 'answered' && result.status === 'Accepted') {
      toast.success(
        result.budgetMinor && wallet.data
          ? `Charging started. It stops by itself when ${money(result.budgetMinor, wallet.data.currency)} is used.`
          : 'Charging started.',
      );
      router.push('/driver/sessions');
    } else if (result.outcome === 'answered') {
      toast.error(`The charger said ${result.status}.`);
    } else {
      toast.error(
        `The charger did not confirm (${result.outcome.replace(/_/g, ' ')}).`,
      );
    }
  }

  const start = useMutation({
    mutationFn: () => {
      const data = station.data!;
      const connector = resolveConnector();
      return driverApiSend<DriverCommandResultDto>('POST', '/driver/charging/start', {
        stationId: data.id,
        ...(data.ocppVersion === '1.6'
          ? { connectorId: connector.connectorId }
          : { evseId: connector.evseId }),
        ...(cardId ? { cardId } : {}),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['driver', 'sessions'] });
      reportCommand(result);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payByCard = useMutation({
    mutationFn: async () => {
      const data = station.data!;
      const connector = resolveConnector();
      const checkout = await driverApiSend<CheckoutDto>('POST', '/driver/charging/holds', {
        stationId: data.id,
        ...(data.ocppVersion === '1.6'
          ? { connectorId: connector.connectorId }
          : { evseId: connector.evseId }),
        ...(cardId ? { cardId } : {}),
      });
      const paid = await openRazorpayCheckout({
        keyId: checkout.keyId,
        orderId: checkout.orderId,
        amountMinor: checkout.amountMinor,
        currency: checkout.currency,
        name: checkout.name,
        description: checkout.description,
        email: checkout.email ?? driver.email ?? undefined,
        contact: checkout.contact ?? driver.phone ?? undefined,
      });
      return driverApiSend<HoldConfirmedDto>(
        'POST',
        `/driver/charging/holds/${checkout.payment.id}/confirm`,
        paid,
      );
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['driver', 'sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['driver', 'wallet'] });
      if (result.command) reportCommand(result.command);
      else toast.success('Hold confirmed.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (station.isPending) return <Loading />;
  if (station.isError) return <Failed error={station.error} />;

  const doc = station.data;
  const selectedKey = connectorKey ?? (doc.connectors[0] ? connectorOf(doc.connectors[0]) : undefined);
  const appCard = cards.data?.find((c) => c.isAppCard);

  return (
    <>
      <PageHeader
        title={doc.siteName ?? doc.identity}
        description={[doc.address, doc.city].filter(Boolean).join(', ') || doc.identity}
      />

      <div className="space-y-4">
        <Card size="sm">
          <CardContent className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant="outline"
              className={
                doc.online
                  ? 'border-emerald-600/30 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400'
                  : 'text-muted-foreground'
              }
            >
              {doc.online ? 'online' : 'offline'}
            </Badge>
          </CardContent>
        </Card>

        {doc.connectors.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            This charger has not reported any connectors yet.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Connector</p>
              <Select
                value={selectedKey}
                onValueChange={(value) => setConnectorKey(value ?? undefined)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a connector" />
                </SelectTrigger>
                <SelectContent>
                  {doc.connectors.map((connector) => (
                    <SelectItem
                      key={connectorOf(connector)}
                      value={connectorOf(connector)}
                    >
                      {connector.label ?? connectorLabel(connector)} ·{' '}
                      {connector.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1">
                {doc.connectors.map((connector) => (
                  <ConnectorBadge
                    key={connectorOf(connector)}
                    status={connector.status}
                  />
                ))}
              </div>
            </div>

            <QuoteCard stationId={doc.id} />

            {cards.data && cards.data.length > 1 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Card</p>
                <Select
                  value={cardId ?? appCard?.id}
                  onValueChange={(value) => setCardId(value ?? undefined)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Your app card" />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.data.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.label ?? (card.isAppCard ? 'App card' : card.token)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button
              className="w-full"
              disabled={!doc.online || start.isPending || !selectedKey}
              onClick={() => start.mutate()}
            >
              {start.isPending ? 'Starting…' : 'Start charging'}
            </Button>
            {wallet.data?.enabled ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={!doc.online || payByCard.isPending || !selectedKey}
                onClick={() => payByCard.mutate()}
              >
                {payByCard.isPending ? 'Opening Checkout…' : 'Pay by card instead'}
              </Button>
            ) : null}
            {!doc.online ? (
              <p className="text-muted-foreground text-center text-xs">
                This charger is offline right now.
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function connectorOf(connector: DriverConnectorDto): string {
  return `${connector.evseId}-${connector.connectorId}`;
}

function connectorLabel(connector: DriverConnectorDto): string {
  return connector.connectorType
    ? `${connector.connectorType} (connector ${connector.connectorId})`
    : `Connector ${connector.connectorId}`;
}
