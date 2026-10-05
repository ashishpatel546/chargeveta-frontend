'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { driverApiGet } from '@/lib/api/driver-client';
import type { DriverQuoteDto, DriverQuotePriceDto } from '@/lib/api/driver-types';
import { energy, money } from '@/lib/format';

type Mode = 'amount' | 'energy';

const TIME_CHARGES: Record<string, string> = {
  charging_time: 'charging time',
  idle: 'idle time after charging',
  occupancy: 'time at the charger',
};

/**
 * What charging here would cost, before starting (doc 6 §22.4 "Session
 * limits"). Every figure comes from `GET /driver/stations/:id/quote`, which
 * prices with the same code as the receipt; the page only turns the driver's
 * typed rupees or kWh into the query's minor units or Wh.
 */
export function QuoteCard({ stationId }: { stationId: string }) {
  const [mode, setMode] = useState<Mode>('amount');
  const [typed, setTyped] = useState('');
  const [asked, setAsked] = useState<string | null>(null);

  // Asks once the driver stops typing, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setAsked(queryFor(mode, typed)), 400);
    return () => clearTimeout(timer);
  }, [mode, typed]);

  const quote = useQuery({
    queryKey: ['driver', 'quote', stationId, asked],
    queryFn: () =>
      driverApiGet<DriverQuoteDto>(
        `/driver/stations/${stationId}/quote${asked ? `?${asked}` : ''}`,
      ),
    placeholderData: (previous) => previous,
  });

  const data = quote.data;
  if (!data || !data.priced || !data.currency) return null;
  const currency = data.currency;

  return (
    <Card className="rounded-[22px]">
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          <p className="text-muted-foreground">Price</p>
          {data.energyPricePerKwhMinor !== null ? (
            <p>
              <span className="readout text-[40px]">
                {money(data.energyPricePerKwhMinor, currency)}
              </span>
              <span className="text-muted-foreground ml-1.5 text-base">per kWh</span>
            </p>
          ) : (
            <p className="font-medium">No energy price</p>
          )}
          <p className="text-muted-foreground">
            {data.sessionFeeMinor !== null
              ? `Plus ${money(data.sessionFeeMinor, currency)} per session`
              : ''}
            {data.taxRatePercent !== '0'
              ? `${data.sessionFeeMinor !== null ? ', plus' : 'Plus'} ${data.taxRatePercent}% GST`
              : ''}
          </p>
        </div>

        {data.wallet ? (
          <BudgetLine
            label={`Your wallet (${money(data.wallet.amountMinor, currency)})`}
            buys={data.wallet.buys}
          />
        ) : null}
        {data.hold ? (
          <BudgetLine
            label={`With a card hold, up to ${money(data.hold.amountMinor, currency)}`}
            buys={data.hold.buys}
          />
        ) : null}

        <div className="space-y-2 border-t pt-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'amount' ? 'default' : 'outline'}
              onClick={() => {
                setMode('amount');
                setTyped('');
              }}
            >
              By amount
            </Button>
            <Button
              size="sm"
              variant={mode === 'energy' ? 'default' : 'outline'}
              onClick={() => {
                setMode('energy');
                setTyped('');
              }}
            >
              By kWh
            </Button>
          </div>
          <Label htmlFor="quote-input">
            {mode === 'amount' ? `Amount (${currency})` : 'Energy (kWh)'}
          </Label>
          <Input
            id="quote-input"
            type="number"
            inputMode="decimal"
            min="0"
            step={mode === 'amount' ? '1' : '0.5'}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={mode === 'amount' ? '500' : '20'}
          />
          {asked && data.requested ? (
            <RequestedLine mode={mode} price={data.requested} currency={currency} />
          ) : null}
        </div>

        {data.notIncluded.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Estimates cover energy only; charges for{' '}
            {data.notIncluded.map((key) => TIME_CHARGES[key] ?? key).join(', ')} depend
            on how long you stay and are added on the receipt.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BudgetLine({
  label,
  buys,
}: {
  label: string;
  buys: DriverQuotePriceDto | null;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {buys ? `about ${energy(buys.energyWh)}` : '—'}
      </span>
    </div>
  );
}

function RequestedLine({
  mode,
  price,
  currency,
}: {
  mode: Mode;
  price: DriverQuotePriceDto;
  currency: string;
}) {
  const split =
    price.taxMinor !== '0'
      ? ` (${money(price.netMinor, currency)} + ${money(price.taxMinor, currency)} GST)`
      : '';
  return (
    <p className="font-medium">
      {mode === 'amount'
        ? `Buys about ${energy(price.energyWh)} for ${money(price.grossMinor, currency)}${split}`
        : `About ${money(price.grossMinor, currency)}${split}`}
    </p>
  );
}

/** The quote's query for what the driver typed, or null when it is not a number. */
function queryFor(mode: Mode, typed: string): string | null {
  const value = Number(typed);
  if (!typed || !Number.isFinite(value) || value <= 0) return null;
  return mode === 'amount'
    ? `amountMinor=${Math.round(value * 100)}`
    : `energyWh=${Math.round(value * 1000)}`;
}
