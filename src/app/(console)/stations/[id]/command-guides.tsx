'use client';

import { InfoDialog } from '@/components/info-dialog';
import type { OcppVersion } from '@/lib/api/types';

/**
 * The long explanations behind the command form.
 *
 * `command-catalogue.ts` holds each command's one-line description and field
 * hints, which are always on screen. What needs a table or a sequence of steps
 * lives here, keyed by the same id, and is shown as an "i" beside the
 * description. A command with no entry simply has no "i".
 */
export function CommandGuide({
  commandId,
  ocppVersion,
}: {
  commandId: string;
  ocppVersion: OcppVersion;
}) {
  if (commandId === 'remote-start') {
    return <RemoteStartGuide ocppVersion={ocppVersion} />;
  }
  return null;
}

function RemoteStartGuide({ ocppVersion }: { ocppVersion: OcppVersion }) {
  const is16 = ocppVersion === '1.6';
  return (
    <InfoDialog
      title="Starting a session remotely"
      summary="Asks the charger to start charging for a card, without anyone tapping it at the charger."
    >
      <h3>Before you send it</h3>
      <ul>
        <li>The car must be plugged in, or be plugged in shortly after.</li>
        <li>
          The <strong>card</strong> is the card number (ID token) the session
          will be recorded and billed against — find it under Cards. If the
          card belongs to a driver, it appears in their history.
        </li>
        <li>
          {is16 ? (
            <>
              <strong>Connector</strong>: which plug to start on (this is an
              OCPP 1.6 charger, so it is addressed by connector number). Leave
              it empty to let the charger choose.
            </>
          ) : (
            <>
              <strong>EVSE</strong>: which charging point to start on (this is
              an OCPP {ocppVersion} charger, so it is addressed by EVSE; the
              charger picks the plug on it). Leave it empty to let the charger
              choose.
            </>
          )}
        </li>
      </ul>

      <h3>What happens, step by step</h3>
      <ol className="ml-4 list-decimal space-y-1">
        <li>
          <strong>The card is checked here first</strong>, by the same rules
          as a card tapped at the charger: blocked, expired, unknown, or
          already charging elsewhere (if your settings forbid that). A card
          that fails is refused straight away and the charger is never asked.
        </li>
        <li>
          <strong>The charger is asked</strong> to start (
          {is16 ? (
            <code>RemoteStartTransaction</code>
          ) : (
            <code>RequestStartTransaction</code>
          )}
          ).
        </li>
        <li>
          <strong>It answers Accepted or Rejected.</strong> Accepted only means
          it agreed to try — not that charging has begun. Rejected usually
          means the connector is faulted, unavailable, or already in use.
        </li>
        <li>
          <strong>The session appears</strong> under Sessions when the charger
          reports that charging actually started. If no car is plugged in, the
          charger waits for one for a while (its own setting) and then gives
          up — no session is created and nothing is billed.
        </li>
      </ol>

      <h3>Drivers do the same from the app</h3>
      <p>
        When a driver taps Start in the driver app, the same thing happens with
        their app card — plus one more check first: their wallet must hold the
        minimum balance (or a payment must be authorised), or the start is
        refused before the charger is asked.
      </p>

      <h3>Stopping it</h3>
      <p>
        Open the session under Sessions and use Stop. The driver can also stop
        it from the app or at the charger.
      </p>
    </InfoDialog>
  );
}

/** What every command's answer means — read before sending one twice. */
export function CommandsInfo() {
  return (
    <InfoDialog
      title="Commands and their answers"
      summary="A command is a request sent to the charger over its live connection. What came back is shown under the form and in the list below."
    >
      <p>
        Pick a command, fill in what it needs, and send it. Only commands your
        role may send and this charger’s OCPP version supports are listed.
      </p>

      <h3>What the answer means</h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <tbody className="[&_td]:p-2 [&_td]:align-top [&_tr+tr_td]:border-t">
            <Row
              term="answered"
              text="The charger replied. Its reply (for example Accepted or Rejected) is shown next to it — Rejected is still a reply."
            />
            <Row
              term="not connected"
              text="The charger is offline. Nothing was sent, so it is safe to try again later."
            />
            <Row
              term="timeout"
              text="Sent, but the charger did not reply in time. It may still have done it — check before sending again."
            />
            <Row
              term="disconnected"
              text="The charger dropped its connection while the command was in flight."
            />
            <Row
              term="charger error"
              text="The charger replied with an error instead of an answer, usually because it does not understand or support the request."
            />
            <Row
              term="unsupported"
              text="This command does not exist in the OCPP version the charger speaks."
            />
            <Row
              term="busy"
              text="Too many commands are already waiting for this charger. Wait a moment and try again."
            />
            <Row
              term="engine error / unreachable"
              text="A problem on the platform side, not the charger. Try again; if it persists, contact support."
            />
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground">
        Before re-sending anything that changes the charger (start, restart,
        unlock), check whether it was <strong>delivered</strong>: one that never
        reached the charger certainly did not happen, but one that reached it
        and timed out may have.
      </p>
    </InfoDialog>
  );
}

function Row({ term, text }: { term: string; text: string }) {
  return (
    <tr>
      <td className="font-medium whitespace-nowrap">{term}</td>
      <td>{text}</td>
    </tr>
  );
}
