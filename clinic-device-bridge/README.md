# ClinicWorks Device Bridge

Local gateway between medical hardware/vendor SDKs and the ClinicWorks POS
Vital Signs screen. It listens only on `127.0.0.1` and has no runtime
dependencies beyond Node.js 20+.

## Start on the clinic computer

```bash
cd clinic-device-bridge
npm start
```

The POS default Bridge URL is `http://127.0.0.1:17891`. In ClinicWorks open
Medical → Vital Signs, click **Test**, then **Read latest** or enable
**Auto 2 sec**.

For a different POS origin, set a comma-separated allowlist before starting:

```bash
CLINIC_BRIDGE_ORIGINS=https://your-pos.example.com npm start
```

## Adapter contract

An iHealth/vendor SDK, Bluetooth gateway, or serial adapter sends readings to:

```http
POST http://127.0.0.1:17891/v1/vitals
Content-Type: application/json

{
  "patientId": "customer-id-if-known",
  "temperatureC": 36.7,
  "weightKg": 68.25,
  "heightCm": 172.4,
  "measuredAt": "2026-08-26T10:00:00.000Z",
  "deviceId": "IHEALTH-PT3SBT-001",
  "source": "ihealth-vendor-sdk"
}
```

Partial readings are allowed, so the thermometer may send only
`temperatureC`. The POS combines the latest device values with manual values,
validates safe ranges, calculates BMI, and saves only after a staff member
confirms the complete set against a selected patient.

Set `CLINIC_BRIDGE_SECRET` to require the same value in the
`X-Clinic-Bridge-Secret` header for adapters. Never commit the secret.

## Hardware paths

- USB/RS-232 physician scale: connect directly from the Vital Signs card in
  Chrome or Edge using Web Serial. The parser only accepts explicit units.
- BLE thermometer such as iHealth PT3SBT: use the manufacturer's SDK or an
  approved gateway, then POST its measurement to this bridge. Do not guess
  undocumented BLE service UUIDs.
- Manual entry remains available if a device, driver, or browser is offline.

Ask each supplier for the exact serial protocol/baud settings and for the
official SDK/API before purchase. A USB plug alone does not guarantee that the
device exposes measurements digitally.
