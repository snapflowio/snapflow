# Snapflow TypeScript SDK

The official server-side TypeScript SDK for creating and controlling Snapflow
sandboxes through the Snapflow API and Edge network.

```bash
npm install @snapflow/sdk
```

## Configuration

Pass configuration explicitly or set `SNAPFLOW_API_KEY` and `SNAPFLOW_API_URL`.
Explicit values take precedence over environment values.

```ts
import { SandboxMode, Snapflow } from '@snapflow/sdk';

const snapflow = new Snapflow({
  apiKey: process.env.SNAPFLOW_API_KEY,
  apiUrl: process.env.SNAPFLOW_API_URL,
});
```

`apiUrl` defaults to `https://snapflow.io/api`. An API key is always
required.

## Create and use a sandbox

Create waits for the accepted sandbox to reach its running state. Timeouts are
expressed in seconds; a timeout of zero waits without a deadline.

```ts
const sandbox = await snapflow.create(
  {
    mode: SandboxMode.Ephemeral,
    image: 'ubuntu:24.04',
    resources: { cpu: 2, memory: 4, disk: 20 },
  },
  { timeout: 120 },
);

try {
  const result = await sandbox.process.executeCommand(
    'printf "Hello from Snapflow\\n"',
  );
  process.stdout.write(result.result);
} finally {
  await sandbox.delete(60);
}
```

The SDK also supports snapshots, volumes, files, Git operations, persistent
command sessions, PTYs, code interpretation, computer use, SSH grants, and
HTTP exposure grants. Toolbox traffic is resolved through a protected system
exposure and routed through Snapflow Edge; callers do not receive Machine
control credentials or dial a Machine directly.

## Placement and prices

Sandboxes run on marketplace machines. All prices are strings of integer
micro-USD: one US dollar is `1000000` micro-USD, so `'250000'` is $0.25. Prices
are all-in and include the platform fee.

A placement is either flexible or pinned:

- **Flexible** (the default) lets Snapflow pick the best machine that matches
  `category`, `minimumTier` and `maxHourlyPriceMicroUsd`. Machines nearest to
  the caller are preferred: the API locates the calling IP and every machine
  automatically, so a sandbox created from a server lands close to that
  server. Set `locations` to restrict placement to continents
  (`Continent.Europe`) or ISO 3166-1 alpha-2 countries (`'DE'`), most preferred
  first. Set `ownMachinesOnly` to run only on your organization's own machines,
  where machine time is free and does not count against quotas (network
  traffic is still billed).
- **Pinned** runs the sandbox on one `machineId`. Pass the `priceCardId` from a
  quote as `expectedPriceCardId` to fail instead of accepting a changed price.

```ts
import {
  Continent,
  MachineCategory,
  MachineTier,
  SandboxMode,
} from '@snapflow/sdk';

const resources = { cpu: 2, memory: 4, disk: 20 };
const placement = {
  category: MachineCategory.General,
  locations: ['DE', Continent.Europe],
  minimumTier: MachineTier.Verified,
  maxHourlyPriceMicroUsd: '250000',
};

const quote = await snapflow.quote({ placement, resources });
console.log(quote.hourlyPriceMicroUsd, quote.monthlyPriceMicroUsd);

const sandbox = await snapflow.create({
  mode: SandboxMode.Standard,
  image: 'ubuntu:24.04',
  placement,
  resources,
});

const pinnedQuote = await snapflow.quote({
  placement: { machineId },
  resources,
});
const pinned = await snapflow.create({
  mode: SandboxMode.Standard,
  image: 'ubuntu:24.04',
  placement: { machineId, expectedPriceCardId: pinnedQuote.priceCardId },
  resources,
});
```

A quote is an estimate and does not reserve a machine. Creating the sandbox
opens a lease that locks the price for `priceLockDays`.

### Start and move

`start` chooses what a pinned sandbox does when its machine is full, offline,
draining or unlisted: `fail` (the default) rejects, `wait` keeps retrying for a
while, and `move` restores the sandbox onto a matching machine at no more than
`maxHourlyPriceMicroUsd`. A stopped sandbox can also be moved explicitly, to a
given machine or to the best match.

```ts
import { WhenMachineUnavailable } from '@snapflow/sdk';

await sandbox.start({
  whenMachineUnavailable: WhenMachineUnavailable.Move,
  maxHourlyPriceMicroUsd: '300000',
  timeout: 120,
});

await sandbox.stop();
await sandbox.move({ maxHourlyPriceMicroUsd: '200000' });
```

### Leases

`lease()` returns the locked price of the current placement. When the lock ends
and the host has raised the price above your cap, the lease needs your
consent: accept the current price card or move the sandbox before
`renewalDeadline`, after which the sandbox is stopped and cannot start.

```ts
import { LeaseRenewalState } from '@snapflow/sdk';

const lease = await sandbox.lease();
if (lease.renewalState === LeaseRenewalState.RenewalRequired) {
  const { priceCardId } = await snapflow.quote({
    placement: { machineId: lease.machineId },
    resources: {
      cpu: lease.cpu,
      memory: lease.memoryGiB,
      disk: lease.diskGiB,
      gpu: lease.gpu,
    },
  });
  if (priceCardId) {
    await sandbox.acceptLeaseRenewal(priceCardId);
  }
}
```

## Computer use and the desktop link

Create the sandbox with the desktop capability, start the desktop, then drive
it through `sandbox.computerUse` or open it in a browser with a desktop link.
The link is a single-use URL: Snapflow Edge redeems it into a session cookie
for the desktop host and serves the KasmVNC web client.

```ts
import { SandboxCapability, SandboxMode, Snapflow } from '@snapflow/sdk';

const snapflow = new Snapflow();
const sandbox = await snapflow.create({
  mode: SandboxMode.Ephemeral,
  capabilities: [SandboxCapability.Desktop],
});

await sandbox.computerUse.start();
const shot = await sandbox.computerUse.screenshot.takeFullScreen();

const link = await sandbox.computerUse.getDesktopLink({
  sessionLifetimeSeconds: 15 * 60,
});
console.log(`Open the desktop: ${link.url}`);
```

Protected Edge sessions, including the toolbox session the SDK uses and the
desktop link, are renewed while they carry traffic. Long-lived connections such
as PTYs, followed logs, and the VNC WebSocket stay open while the session is in
use and still authorized. A session ends after `sessionLifetimeSeconds` without
use, when its grant is revoked, when the principal loses access to the
sandbox, or at its fixed absolute lifetime, and the Edge then closes its
live connections.

## Lifecycle and cancellation

Creation accepts an `AbortSignal`. Aborting a local wait does not imply that an
already accepted remote operation was cancelled. Retain the sandbox identifier
and retrieve it with `snapflow.get(id)` before deciding whether to retry or
delete it.

```ts
const controller = new AbortController();
const sandbox = await snapflow.create(
  { mode: SandboxMode.Ephemeral },
  { timeout: 120, signal: controller.signal },
);

await sandbox.stop();
await sandbox.start();
await sandbox.delete();
```

## Safe mutation retries

The SDK creates a cryptographically random `Idempotency-Key` for every logical
duplicate-sensitive mutation, including sandbox, snapshot, fork, SSH access,
protected Edge access, and volume operations. If application code retries after
losing a response, preserve the original key explicitly; a new key represents a
new operation.

```ts
const idempotencyKey = crypto.randomUUID();

const sandbox = await snapflow.create(
  { mode: SandboxMode.Ephemeral, image: 'ubuntu:24.04' },
  { idempotencyKey, timeout: 120 },
);

const volume = await snapflow.volume.create(
  { name: 'workspace', sizeGiB: 20 },
  { idempotencyKey: crypto.randomUUID() },
);

await sandbox.createSshAccess(15, {
  idempotencyKey: crypto.randomUUID(),
});

await snapflow.snapshot.create(
  { name: 'python-tools', image: 'ubuntu:24.04' },
  { idempotencyKey: crypto.randomUUID() },
);
```

Keys are scoped by authenticated principal, HTTP method, route,
and request fingerprint. Reusing a key with different semantic input is
rejected. Snapflow retains completed records for the configured server
retention window; callers must not reuse old keys for unrelated operations.

## Errors

All public operations reject with a `SnapflowError` subtype for authentication,
authorization, validation, conflict, not-found, rate-limit, timeout, and
connection failures. Use the error class and structured fields for control flow
instead of parsing the human-readable message.

```ts
import { SnapflowError, SnapflowTimeoutError } from '@snapflow/sdk';

try {
  await snapflow.get('sandbox-id');
} catch (error) {
  if (error instanceof SnapflowTimeoutError) {
    // The remote operation may still be running.
  } else if (error instanceof SnapflowError) {
    console.error(error.message);
  }
}
```

Placement conflicts have their own `SnapflowConflictError` subtypes:

- `SnapflowMachineUnavailableError` carries the `reason` (`full`, `offline`,
  `paused` or `exposure_limited`) and up to five `alternatives`, each with a
  `machineId`, `location`, `priceCardId` and `hourlyPriceMicroUsd`.
- `SnapflowPriceChangedError` carries the new `quote` when a pinned price card
  changed since it was quoted, or the current `priceCardId` when a lease
  renewal named an outdated card.
- `SnapflowLeaseRenewalRequiredError` carries the `leaseId` and
  `renewalDeadline` of a lease that needs consent before the sandbox can start.

```ts
import {
  SnapflowMachineUnavailableError,
  SnapflowPriceChangedError,
} from '@snapflow/sdk';

try {
  await snapflow.create({
    mode: SandboxMode.Standard,
    placement: { machineId, expectedPriceCardId },
  });
} catch (error) {
  if (error instanceof SnapflowMachineUnavailableError) {
    console.log(error.reason, error.alternatives);
  } else if (error instanceof SnapflowPriceChangedError) {
    console.log(error.quote?.hourlyPriceMicroUsd);
  }
}
```
