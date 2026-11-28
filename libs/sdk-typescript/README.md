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
  where machine time is free and does not count against quotas (Snapflow
  storage is still billed).
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

A quote is an estimate and does not reserve a machine. `hourlyPriceMicroUsd`
is the all-in price (the host's price plus Snapflow's markup, settled in USDC
1:1); a pinned quote also carries `wholeMachineHourlyPriceMicroUsd`. Usage is
metered per second with a 10-second minimum per start.
`maxHourlyPriceMicroUsd` is the sandbox's maximum price: placement skips
pricier machines, and a running sandbox whose host raises its price above it
stops and keeps its disk.

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

### Prices, stopped and archived sandboxes

`pricing()` returns what the sandbox pays on its machine. A price cut applies
at once; an increase reaches the sandbox at its next start or at
`priceIncreaseAt`, whichever is first, and a start above
`maxHourlyPriceMicroUsd` fails with `SnapflowPriceAboveMaximumError`.

A stopped sandbox keeps its disk on the host and restarts there quickly; after
some days stopped, or when its host goes away or the balance runs out, it is
archived to Snapflow storage and restored from there on its next start.
`sandbox.state` shows `stopped` or `archived`, and `expectedStartSeconds`
about how long `start()` takes.

```ts
import { SandboxState } from '@snapflow/sdk';

const { hourlyPriceMicroUsd, priceIncreaseAt } = await sandbox.pricing();
await sandbox.refreshData();
if (sandbox.state === SandboxState.Archived) {
  console.log(`restoring takes about ${sandbox.expectedStartSeconds}s`);
}
```

### API key budgets

An API key can carry a budget: compute dollars per 30 days and sandboxes
running at once. Compute is what the key's sandboxes cost while they run; the
disk of stopped sandboxes is billed to the organization and does not count. A
key at its budget is refused new starts with HTTP 402 and its running
sandboxes stop. Budgets are set from a signed-in dashboard session, so a key
can never raise its own limit; the SDK reads them.

```ts
const { computeSpendMicroUsd, exhausted } = await snapflow.budgets.apiKey(apiKeyId);
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

## Paying with USDC escrow

Sandboxes are paid from the organization's funding wallet through the
SnapflowEscrow contract. `snapflow.settlement.escrow(...)` binds the wallet to
the escrow, USDC token and chain Snapflow reports, so no address is hardcoded.
Amounts are USDC base units (6 decimals, micro-USD). Every write waits for its
receipt and rejects with `SnapflowEscrowError`, which names the contract's
custom error in `contractError` when the call reverts.

```ts
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { base } from 'viem/chains';

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: custom(window.ethereum),
});
const publicClient = createPublicClient({ chain: base, transport: http() });
const escrow = await snapflow.settlement.escrow({ walletClient, publicClient });

await escrow.deposit(50_000_000n); // approves USDC first when needed
await escrow.deposit(10_000_000n, { permit: true }); // EIP-2612 permit instead
const { free, pending, unlockAt } = await escrow.readAccount();

await escrow.requestWithdrawal(5_000_000n); // stops counting as spendable now
await escrow.cancelWithdrawal(); // or wait out escrow.readWithdrawalDelay()
await escrow.completeWithdrawal(); // pays out once unlockAt has passed
```

Deposits land in the wallet's free balance. Hosts are paid from it through
one payment channel per customer and host: Snapflow issues a cumulative
voucher every few minutes and the host claims it. A requested withdrawal
stops counting as spendable at once and pays out after the escrow's
withdrawal delay (24 hours), claimable by hosts until then.
`snapflow.settlement.escrowAccount()` reports the balances and runway, and
`snapflow.settlement.channels()` what each channel charged and paid.

A payer can also fund the escrow without gas (ERC-3009): it signs for the
relayer it names, and only that relayer can submit it, keeping the optional
relay fee for the gas.

```ts
const signed = await payerEscrow.signDepositAuthorization(
  20_000_000n,
  escrow.account,
  { customer: fundingWallet, relayFee: 10_000n }
);
await escrow.depositWithAuthorization(signed);
```

Auto top-up lets Snapflow's relayer pull exactly `amount` from the wallet's
USDC allowance into its own balance while the available balance is below
`threshold`, at most `timesPerDay` times a day (1 to 24) and for a capped
relay fee. `enableAutoTopUp` saves the terms at Snapflow (amounts in micro-USD,
which equal USDC base units), then approves the allowance and sets the same
terms on-chain from the wallet:

```ts
await snapflow.settlement.enableAutoTopUp(escrow, {
  amount: '50000000',
  threshold: '20000000',
  maxRelayFee: '50000',
  timesPerDay: 4,
  allowance: 500_000_000n,
});
await snapflow.settlement.disableAutoTopUp(escrow);
```

By default (`voucherSigning: 'delegated'`) the organization's delegated
signer signs the vouchers that pay hosts. One call authorizes the signer with
its consent proof and the scope Snapflow suggests (hourly cap, expiry, highest
fee and an optional host), with an optional deposit, as a single wallet
request when the wallet supports EIP-5792 batching. A signer's spending limit
is a bucket that starts empty, refills at its hourly cap and holds at most
24 hours of it; each claim pays at most what the bucket holds.
`escrow.readSignerAvailable(address)` reports what it may authorize now.

```ts
await snapflow.settlement.setUpDelegatedPayments(escrow, {
  deposit: 50_000_000n,
});
```

To sign vouchers yourself, create sandboxes with
`voucherSigning: VoucherSigningMode.Client`, authorize a session key you hold
and run a `VoucherSigner`. It polls the pending vouchers, signs only those it
verified locally (the EIP-712 domain is the escrow `getEscrowAccount`
reports, the payment channel is paid by `fundingWallet` and its on-chain id
matches its terms, the voucher carries those terms and pays exactly the fee
`snapflow.settlement.chargedFeeBps()` reports to the fee receiver Snapflow publishes in
its public configuration, is not stamped ahead of
this clock, never stays below the last one and grows no faster than
`maxHourlySpend` per channel, plus `SPEND_RATE_TOLERANCE_MILLISECONDS`, up to
the optional `maxChannelSpend`) and backs off exponentially while the API
fails. The SDK never stores the key; persisting it is up to you.

```ts
import { generateSessionKey, VoucherSigningMode } from '@snapflow/sdk';
import { zeroAddress } from 'viem';

const sessionKey = generateSessionKey(); // store sessionKey.privateKey securely
await escrow.depositAndAuthorize({
  signers: [
    await escrow.sessionKeyAuthorization(sessionKey.privateKey, {
      hourlyCap: 2_000_000n, // refills 2 USDC an hour, holds at most 48
      expiry: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600),
      maxFeeBps: escrow.feeBps, // at most the fee Snapflow charges
      host: zeroAddress, // any host
    }),
  ],
});

const signer = snapflow.settlement.createVoucherSigner({
  sessionKey: sessionKey.privateKey,
  fundingWallet: escrow.account,
  policy: { maxHourlySpend: 2_000_000n, maxChannelSpend: 50_000_000n },
  onError: (error) => console.error(error),
});
signer.start();

await snapflow.create({
  mode: SandboxMode.Standard,
  voucherSigning: VoucherSigningMode.Client,
});
// ...
await signer.stop();
```

Refused vouchers reach `onError` once as `SnapflowVoucherRejectedError` with a
`reason` from `VoucherRejectionReason`.

`escrow.raiseSignerLimit(address, { hourlyCap, expiry })` raises the hourly
cap or extends the expiry at once; `escrow.lowerSignerLimit(address,
hourlyCap)` lowers the cap only after the signer thaw period, so vouchers
hosts already hold stay claimable.

To stop a signer, `escrow.thawSigner(address)` starts its thaw: the key stays
valid until the thaw ends, so hosts can still claim what it signed, and
`escrow.revokeSigner(address)` then removes it for good. A key binds to one
wallet forever, so once the delegated signer is revoked, expired or past its
thaw, `authorizeDelegatedSigner` authorizes a new key Snapflow creates for it.

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
  `machineId`, `location`, all-in `hourlyPriceMicroUsd` and
  `reliabilityBasisPoints`.
- `SnapflowPriceChangedError` carries the new `quote` when the machine's
  all-in hourly price for the shape changed since it was quoted.
- `SnapflowPriceAboveMaximumError` carries the `hourlyPriceMicroUsd` and the
  sandbox's `maxHourlyPriceMicroUsd` when the price is above the maximum.

Usage is billed at the all-in hourly price of the sandbox's shape, metered per
second, and paid through cumulative vouchers on one payment channel per
customer and host.

```ts
import {
  SnapflowMachineUnavailableError,
  SnapflowPriceAboveMaximumError,
} from '@snapflow/sdk';

try {
  await snapflow.create({
    mode: SandboxMode.Standard,
    placement: { machineId, maxHourlyPriceMicroUsd: '250000' },
  });
} catch (error) {
  if (error instanceof SnapflowMachineUnavailableError) {
    console.log(error.reason, error.alternatives);
  } else if (error instanceof SnapflowPriceAboveMaximumError) {
    console.log(error.hourlyPriceMicroUsd);
  }
}
```
