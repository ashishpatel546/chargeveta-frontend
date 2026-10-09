'use client';

import { InfoDialog } from '@/components/info-dialog';

/** How a tariff turns into what a session costs — the whole picture. */
export function TariffsInfo() {
  return (
    <InfoDialog
      title="How tariffs work"
      text="How tariffs work"
      summary="A tariff is a price list. It is attached to a site or a charger, and every session there is billed by it."
    >
      <h3>Which tariff a session uses</h3>
      <ul>
        <li>
          A tariff attached to the <strong>charger</strong> wins. Otherwise the
          tariff attached to the charger’s <strong>site</strong> is used.
        </li>
        <li>
          A session with neither is not priced — it is recorded, but no cost is
          worked out for it.
        </li>
        <li>Attach a tariff from the site’s or the charger’s own page.</li>
      </ul>

      <h3>Versions</h3>
      <p>
        Prices are never edited in place. Changing a price means adding a new
        version, which takes effect now or at a time you choose. A session is
        billed by the version that was in force when it <em>started</em>, so a
        price change never alters a session that has already happened, and a
        receipt can always be explained.
      </p>

      <h3>Currency and tax</h3>
      <p>
        The currency is fixed when the tariff is created. Prices are entered
        excluding tax; GST is added on top at the site’s rate.
      </p>

      <PricesBody />
    </InfoDialog>
  );
}

/** What each price part means, with a worked example. */
export function PricesInfo() {
  return (
    <InfoDialog
      title="Prices"
      summary="Turn on the parts you charge for. A session’s cost is the sum of every part that is on."
    >
      <PricesBody />
    </InfoDialog>
  );
}

function PricesBody() {
  return (
    <>
      <h3>Amounts are in paise</h3>
      <p>
        Every amount is entered in the currency’s smallest unit — paise for
        INR. So ₹18.50 is entered as <code>1850</code>, and ₹20 as{' '}
        <code>2000</code>. Per-kWh and per-minute rates may have up to four
        decimal places (<code>8.3333</code> paise a minute is ₹5 an hour); the
        session fee is a whole number.
      </p>

      <h3>The parts</h3>
      <ul>
        <li>
          <strong>Session fee</strong> — a flat amount added once to every
          session, however short.
        </li>
        <li>
          <strong>Energy</strong> — per kWh delivered to the car, from the
          charger’s meter.{' '}
          <strong>Time-of-day bands</strong> replace this price during their
          hours (for example a higher evening peak rate), in the site’s time
          zone. Bands may not overlap.
        </li>
        <li>
          <strong>Charging time</strong> — per minute from the start of the
          session until energy stopped flowing.
        </li>
        <li>
          <strong>Idle</strong> — per minute <em>after</em> the car finished
          charging but is still plugged in. Use it to free up bays. The{' '}
          <strong>grace</strong> minutes are free: with a 15-minute grace, a car
          left 40 minutes is charged for 25.
        </li>
        <li>
          <strong>Occupancy</strong> — per minute for the <em>whole</em>{' '}
          session, charging or not, after its own grace minutes. Usually used
          instead of charging time and idle, not together with them.
        </li>
      </ul>

      <h3>Example</h3>
      <p>
        Session fee <code>2000</code>, energy <code>1850</code> per kWh, idle{' '}
        <code>100</code> per minute with 15 minutes grace. A driver takes 20
        kWh, then leaves the car plugged in for 25 minutes after it is full:
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <tbody className="[&_td]:p-2 [&_tr+tr_td]:border-t">
            <tr>
              <td>Session fee</td>
              <td className="text-right">₹20.00</td>
            </tr>
            <tr>
              <td>Energy, 20 kWh × ₹18.50</td>
              <td className="text-right">₹370.00</td>
            </tr>
            <tr>
              <td>Idle, (25 − 15) min × ₹1.00</td>
              <td className="text-right">₹10.00</td>
            </tr>
            <tr className="font-medium">
              <td>Total before GST</td>
              <td className="text-right">₹400.00</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground">
        Anything the form cannot express can be written in{' '}
        <strong>Advanced JSON</strong>; the server checks it and explains
        anything it refuses.
      </p>
    </>
  );
}
