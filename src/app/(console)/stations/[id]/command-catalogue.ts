import type { OcppVersion, Role } from '@/lib/api/types';

/**
 * The commands an operator can send a charger, described rather than coded.
 *
 * Each one is a small form over a POST, and they differ only in their fields,
 * so they are written as data and rendered by one component. That keeps the
 * seventeen of them consistent — and it makes the two things that actually vary
 * visible: which role the API requires, and which OCPP versions the field
 * applies to.
 *
 * What is deliberately absent: `set-charging-profile`, which takes a schedule
 * of up to 1024 periods and deserves an editor of its own rather than a row of
 * inputs.
 */

export type FieldType = 'text' | 'number' | 'select' | 'datetime' | 'textarea';

export interface CommandField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  /** Only shown for these OCPP versions. Absent means all of them. */
  versions?: OcppVersion[];
}

export interface CommandSpec {
  /** The path under `/stations/:id/commands/`. */
  id: string;
  label: string;
  /** The weakest role the API accepts for this one. */
  needs: Role;
  description: string;
  fields: CommandField[];
  /** Absent means every version. */
  versions?: OcppVersion[];
}

const EVSE_ID: CommandField = {
  name: 'evseId',
  label: 'EVSE',
  type: 'number',
  versions: ['2.0.1', '2.1'],
  help: 'OCPP 1.6 has no EVSE dimension; leave it empty there.',
};

export const COMMANDS: CommandSpec[] = [
  {
    id: 'remote-start',
    label: 'Start a session',
    needs: 'operator',
    description:
      'Starts charging on the operator’s say-so. The card is judged here first: one that would be refused is refused without asking the charger.',
    fields: [
      {
        name: 'token',
        label: 'Card',
        type: 'text',
        required: true,
        placeholder: 'DEADBEEF',
        help: 'The session is recorded against this card, and it is billed to it.',
      },
      { ...EVSE_ID },
      {
        name: 'connectorId',
        label: 'Connector',
        type: 'number',
        versions: ['1.6'],
      },
    ],
  },
  {
    id: 'reset',
    label: 'Restart',
    needs: 'operator',
    description:
      'Graceful waits for a session to finish; immediate does not, and ends one that is running.',
    fields: [
      {
        name: 'mode',
        label: 'How',
        type: 'select',
        required: true,
        options: [
          { value: 'graceful', label: 'Graceful' },
          { value: 'immediate', label: 'Immediate' },
        ],
      },
      { ...EVSE_ID },
    ],
  },
  {
    id: 'unlock-connector',
    label: 'Unlock a connector',
    needs: 'operator',
    description:
      'Releases the cable. A charger refuses while a session is running, and that refusal is its decision, not an error here.',
    fields: [
      { ...EVSE_ID, required: true },
      {
        name: 'connectorId',
        label: 'Connector',
        type: 'number',
        required: true,
      },
    ],
  },
  {
    id: 'change-availability',
    label: 'Take out of service',
    needs: 'operator',
    description:
      'Inoperative stops the charger accepting new sessions. Leave EVSE and connector empty to apply it to the whole charger.',
    fields: [
      {
        name: 'availability',
        label: 'State',
        type: 'select',
        required: true,
        options: [
          { value: 'inoperative', label: 'Out of service' },
          { value: 'operative', label: 'Back in service' },
        ],
      },
      { ...EVSE_ID },
      { name: 'connectorId', label: 'Connector', type: 'number' },
    ],
  },
  {
    id: 'trigger-message',
    label: 'Ask for a message',
    needs: 'operator',
    description:
      'Asks the charger to send something now rather than waiting for its schedule. Useful for getting a fresh status or meter reading.',
    fields: [
      {
        name: 'message',
        label: 'Message',
        type: 'select',
        required: true,
        options: [
          { value: 'StatusNotification', label: 'Connector status' },
          { value: 'MeterValues', label: 'Meter reading' },
          { value: 'Heartbeat', label: 'Heartbeat' },
          { value: 'BootNotification', label: 'Boot notification' },
          {
            value: 'FirmwareStatusNotification',
            label: 'Firmware status',
          },
        ],
      },
      { ...EVSE_ID },
      { name: 'connectorId', label: 'Connector', type: 'number' },
    ],
  },
  {
    id: 'clear-cache',
    label: 'Clear the card cache',
    needs: 'operator',
    description:
      'Throws away the charger’s remembered card decisions, so the next swipe is asked about again.',
    fields: [],
  },
  {
    id: 'get-configuration',
    label: 'Read settings',
    needs: 'operator',
    description:
      'Reads the charger’s own settings. Leave the list empty to read everything it will give.',
    fields: [
      {
        name: 'keys',
        label: 'Keys',
        type: 'textarea',
        versions: ['1.6'],
        placeholder: 'HeartbeatInterval\nMeterValueSampleInterval',
        help: 'One per line, up to 100.',
      },
      {
        name: 'variables',
        label: 'Variables',
        type: 'textarea',
        versions: ['2.0.1', '2.1'],
        placeholder:
          '[{"component":{"name":"OCPPCommCtrlr"},"variable":{"name":"HeartbeatInterval"}}]',
        help: 'JSON, as OCPP 2.x names a variable by component.',
      },
    ],
  },
  {
    id: 'change-configuration',
    label: 'Change a setting',
    needs: 'admin',
    description:
      'Writes one of the charger’s own settings. A charger may refuse, or accept and need a restart.',
    fields: [
      {
        name: 'key',
        label: 'Key',
        type: 'text',
        versions: ['1.6'],
        placeholder: 'HeartbeatInterval',
      },
      { name: 'value', label: 'Value', type: 'text', versions: ['1.6'] },
      {
        name: 'variables',
        label: 'Variables',
        type: 'textarea',
        versions: ['2.0.1', '2.1'],
        placeholder:
          '[{"component":{"name":"OCPPCommCtrlr"},"variable":{"name":"HeartbeatInterval"},"value":"300"}]',
        help: 'JSON.',
      },
    ],
  },
  {
    id: 'get-local-list-version',
    label: 'Card list version',
    needs: 'operator',
    description:
      'Which version of the offline card list the charger is holding.',
    fields: [],
  },
  {
    id: 'get-diagnostics',
    label: 'Collect logs',
    needs: 'operator',
    description:
      'Asks the charger to upload its logs to somewhere you can read them. The address must be one the charger can reach and write to.',
    fields: [
      {
        name: 'location',
        label: 'Upload to',
        type: 'text',
        required: true,
        placeholder: 'ftp://user:password@host/path',
      },
      {
        name: 'logType',
        label: 'Which log',
        type: 'select',
        versions: ['2.0.1', '2.1'],
        options: [
          { value: 'DiagnosticsLog', label: 'Diagnostics' },
          { value: 'SecurityLog', label: 'Security' },
          { value: 'DataCollectorLog', label: 'Data collector' },
        ],
      },
      { name: 'from', label: 'From', type: 'datetime' },
      { name: 'to', label: 'To', type: 'datetime' },
    ],
  },
  {
    id: 'update-firmware',
    label: 'Update firmware',
    needs: 'admin',
    description:
      'Tells the charger where to fetch firmware and when to fetch it. A charger that checks signatures will refuse an unsigned image, which is it doing its job.',
    fields: [
      {
        name: 'location',
        label: 'Download from',
        type: 'text',
        required: true,
      },
      {
        name: 'retrieveAt',
        label: 'Download at',
        type: 'datetime',
        required: true,
      },
      { name: 'installAt', label: 'Install at', type: 'datetime' },
      {
        name: 'signingCertificate',
        label: 'Signing certificate',
        type: 'textarea',
        help: 'PEM. Needed by chargers that verify firmware.',
      },
      { name: 'signature', label: 'Signature', type: 'textarea' },
    ],
  },
  {
    id: 'clear-charging-profile',
    label: 'Clear a charging limit',
    needs: 'operator',
    description: 'Removes a charging profile the charger is holding.',
    fields: [
      { name: 'profileId', label: 'Profile id', type: 'number' },
      { ...EVSE_ID },
      {
        name: 'purpose',
        label: 'Purpose',
        type: 'select',
        options: [
          { value: 'station-max', label: 'Station maximum' },
          { value: 'tx-default', label: 'Session default' },
          { value: 'tx', label: 'This session' },
        ],
      },
      { name: 'stackLevel', label: 'Stack level', type: 'number' },
    ],
  },
  {
    id: 'get-composite-schedule',
    label: 'Read the charging limit',
    needs: 'operator',
    description:
      'What the charger believes its limit will be over the period, once every profile it holds is combined.',
    fields: [
      {
        name: 'durationSeconds',
        label: 'For how long (seconds)',
        type: 'number',
        required: true,
        placeholder: '3600',
      },
      { ...EVSE_ID },
      {
        name: 'unit',
        label: 'In',
        type: 'select',
        options: [
          { value: 'A', label: 'Amps' },
          { value: 'W', label: 'Watts' },
        ],
      },
    ],
  },
  {
    id: 'install-certificate',
    label: 'Install a certificate',
    needs: 'admin',
    description: 'Puts a root certificate into the charger’s trust store.',
    fields: [
      {
        name: 'certificateType',
        label: 'Kind',
        type: 'select',
        required: true,
        options: [
          { value: 'CSMSRootCertificate', label: 'This system’s root' },
          { value: 'ManufacturerRootCertificate', label: 'Manufacturer root' },
          { value: 'V2GRootCertificate', label: 'V2G root' },
          { value: 'MORootCertificate', label: 'Mobility operator root' },
          { value: 'OEMRootCertificate', label: 'OEM root' },
        ],
      },
      {
        name: 'certificate',
        label: 'Certificate',
        type: 'textarea',
        required: true,
        placeholder: '-----BEGIN CERTIFICATE-----',
      },
    ],
  },
  {
    id: 'get-installed-certificates',
    label: 'List certificates',
    needs: 'operator',
    description: 'What the charger has in its trust store.',
    fields: [],
  },
  {
    id: 'delete-certificate',
    label: 'Delete a certificate',
    needs: 'admin',
    description:
      'Identified by its hashes, which is how OCPP names a certificate without sending it.',
    fields: [
      {
        name: 'hashAlgorithm',
        label: 'Hash',
        type: 'select',
        required: true,
        options: [
          { value: 'SHA256', label: 'SHA-256' },
          { value: 'SHA384', label: 'SHA-384' },
          { value: 'SHA512', label: 'SHA-512' },
        ],
      },
      {
        name: 'issuerNameHash',
        label: 'Issuer name hash',
        type: 'text',
        required: true,
      },
      {
        name: 'issuerKeyHash',
        label: 'Issuer key hash',
        type: 'text',
        required: true,
      },
      {
        name: 'serialNumber',
        label: 'Serial number',
        type: 'text',
        required: true,
      },
    ],
  },
  {
    id: 'certificate-signed',
    label: 'Send a signed certificate',
    needs: 'admin',
    description:
      'Returns the certificate a charger asked to have signed, once a certificate authority has signed it.',
    fields: [
      {
        name: 'certificateChain',
        label: 'Certificate chain',
        type: 'textarea',
        required: true,
      },
      {
        name: 'certificateType',
        label: 'Kind',
        type: 'select',
        options: [
          {
            value: 'ChargingStationCertificate',
            label: 'Charging station',
          },
          { value: 'V2GCertificate', label: 'V2G' },
          { value: 'V2G20Certificate', label: 'V2G 2.0' },
        ],
      },
      { name: 'requestId', label: 'Request id', type: 'number' },
    ],
  },
];

/** The fields that apply to a charger on this version of OCPP. */
export function fieldsFor(
  spec: CommandSpec,
  version: OcppVersion,
): CommandField[] {
  return spec.fields.filter(
    (field) => !field.versions || field.versions.includes(version),
  );
}
