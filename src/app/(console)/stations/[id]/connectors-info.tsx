'use client';

import { InfoDialog } from '@/components/info-dialog';
import type { OcppVersion } from '@/lib/api/types';

/**
 * EVSEs and connectors, explained for the charger in front of the reader.
 *
 * The layout rules differ by OCPP version — 1.6 has no EVSEs at all — so the
 * guide leads with the version this charger speaks.
 */
export function EvsesInfo({
  ocppVersion,
  text,
}: {
  ocppVersion: OcppVersion;
  text?: string;
}) {
  const is16 = ocppVersion === '1.6';
  return (
    <InfoDialog
      title="EVSEs and connectors"
      text={text}
      summary="How a charger’s sockets are laid out here, and what to do when one has two."
    >
      <h3>The three levels</h3>
      <ul>
        <li>
          <strong>Charger (station)</strong> — the whole unit, with one
          connection to the platform.
        </li>
        <li>
          <strong>EVSE</strong> (Electric Vehicle Supply Equipment) — one
          charging point that can run <em>one session at a time</em>. It has
          its own power output and meter. A charger with two EVSEs can charge
          two cars at once.
        </li>
        <li>
          <strong>Connector</strong> — a physical plug or socket on an EVSE. An
          EVSE may have more than one (for example a CCS2 gun and a Type 2
          socket), but only one of them can be in use at a time.
        </li>
      </ul>

      <h3>You usually do not need to add anything</h3>
      <p>
        When a charger connects, it reports the status of each of its
        connectors, and the platform creates the EVSEs and connectors it names.
        An OCPP 2.x charger also reports each connector’s type after every
        boot. Adding them by hand is only for a charger that has not connected
        yet — if the numbers match what the charger later reports, the same
        rows are used.
      </p>

      <h3>
        This charger speaks OCPP {ocppVersion}
        {is16 ? ' — everything goes on EVSE 1' : ''}
      </h3>
      {is16 ? (
        <p>
          OCPP 1.6 has no EVSEs, only numbered connectors. Here every 1.6
          connector is kept under <strong>EVSE 1</strong>: connector 1,
          connector 2, and so on. Do not add an EVSE 2 for a 1.6 charger — 1.6
          has no way to address it, so commands to it would be refused.
        </p>
      ) : (
        <p>
          OCPP 2.x numbers EVSEs from 1, and connectors from 1{' '}
          <em>within each EVSE</em>. So two separate charging points are EVSE 1
          connector 1 and EVSE 2 connector 1 — not connector 1 and 2.
        </p>
      )}

      <h3>A charger with two connectors</h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2 font-medium">The charger</th>
              <th className="p-2 font-medium">OCPP 1.6</th>
              <th className="p-2 font-medium">OCPP 2.x</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:p-2 [&_td]:align-top">
            <tr>
              <td>Two cars can charge at the same time</td>
              <td>EVSE 1 → connectors 1 and 2</td>
              <td>
                EVSE 1 → connector 1
                <br />
                EVSE 2 → connector 1
              </td>
            </tr>
            <tr>
              <td>
                Two plug types, one car at a time (e.g. CCS2 + CHAdeMO sharing
                one power unit)
              </td>
              <td>EVSE 1 → connectors 1 and 2</td>
              <td>EVSE 1 → connectors 1 and 2</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground">
        If unsure, connect the charger and let it report — its own layout is
        always the right one.
      </p>

      <h3>What you can set on a connector</h3>
      <ul>
        <li>
          <strong>Name</strong> — what drivers and staff call it on site, such
          as “Left gun” or “Bay 3”.
        </li>
        <li>
          <strong>Type</strong> — the plug. A 1.6 charger never reports it, so
          set it by hand there. <ConnectorTypeList />
        </li>
        <li>
          <strong>Retire</strong> — for a socket that has been removed. Its
          history is kept, its status stops following the charger, and the
          charger cannot re-create it. There is no delete, because the next
          status report would simply add it back.
        </li>
      </ul>
      <p className="text-muted-foreground">
        “Reported by the charger” means the charger created this row itself;
        “added here” means someone added it on this page.
      </p>
    </InfoDialog>
  );
}

/** What to type as a connector's type: the names OCPP itself uses. */
export function ConnectorTypeInfo() {
  return (
    <InfoDialog
      title="Connector type"
      summary="The plug or socket this connector has. Use the name OCPP uses, so it matches what a 2.x charger reports."
    >
      <ConnectorTypeList />
      <p className="text-muted-foreground">
        A <code>c</code> prefix is a cable fixed to the charger; an{' '}
        <code>s</code> prefix is a socket the driver plugs their own cable
        into.
      </p>
    </InfoDialog>
  );
}

function ConnectorTypeList() {
  return (
    <span className="mt-1 block">
      Common values: <code>cCCS2</code> (CCS2 DC gun), <code>cType2</code>{' '}
      (Type 2 AC cable), <code>sType2</code> (Type 2 AC socket),{' '}
      <code>cG105</code> (CHAdeMO), <code>cCCS1</code>, <code>cType1</code>,{' '}
      <code>cTesla</code>. For a plug OCPP has no name for (such as a
      household 3-pin socket), write it plainly.
    </span>
  );
}

/** Why one would add an EVSE, and which number to give it. */
export function AddEvseInfo({ ocppVersion }: { ocppVersion: OcppVersion }) {
  return (
    <InfoDialog
      title="Adding an EVSE"
      summary="Only needed before the charger has connected; a connected charger creates its own."
    >
      <p>
        An EVSE is one charging point — it charges one car at a time. Add one
        per point the charger has, numbered from 1, then add its connectors
        inside it.
      </p>
      {ocppVersion === '1.6' ? (
        <p>
          This charger speaks OCPP 1.6, which has no EVSEs: add only{' '}
          <strong>EVSE 1</strong>, and put all of its connectors (1, 2, …)
          under it.
        </p>
      ) : (
        <p>
          This charger speaks OCPP {ocppVersion}. A charger that charges two
          cars at once has EVSE 1 and EVSE 2, each with its own connector 1. A
          single point with two plug types is one EVSE with connectors 1 and 2.
        </p>
      )}
      <p className="text-muted-foreground">
        The number must match what the charger will report, or it will create
        a second set of its own when it connects.
      </p>
    </InfoDialog>
  );
}
