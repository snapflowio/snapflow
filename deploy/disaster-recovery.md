# Disaster recovery

Production runs on one k3s server. These notes cover what is backed up, what must
live off the host, and the order to bring the platform back on a new machine.

## What is backed up

| Data | How | Where in R2 (`snapflow-backups`) | Retention | Locked against deletion |
|---|---|---|---|---|
| Postgres | Barman Cloud plugin: daily base backup at 03:00 plus continuous WAL archiving | `postgres/` | 30 days, point-in-time (Barman) | 14 days |
| OpenBao | `openbao-backup` CronJob, raft snapshot at 03:30 | `openbao/` | 30 days (R2 lifecycle) | 14 days |
| Kubernetes state | k3s embedded etcd snapshots every 6 hours | `k3s/` | 28 snapshots (k3s) | 6 days |

The backup jobs share one R2 key, and R2 cannot issue write-only keys, so
deletion is guarded by R2 bucket lock rules instead: nobody holding that key
can delete or overwrite a backup younger than its lock, and lifecycle rules,
not the jobs, delete old OpenBao snapshots. Each lock is shorter than its
retention so Barman and k3s can still prune their own expired backups. Both
rule sets and the buckets are declared in `deploy/tofu/cloudflare`; apply them
with `moon run deploy:cloudflare`, which needs `CLOUDFLARE_API_TOKEN` (Workers
R2 Storage Write), the backup key as `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` (the state lives under `tofu/` in `snapflow-backups`)
and `TF_VAR_state_passphrase`. Removing a lock needs an account-level
Cloudflare token, never the backup key. The repository's settings, rulesets
and environments are declared the same way in `deploy/tofu/github`
(`moon run deploy:github` with `GITHUB_TOKEN` from `gh auth token`).

User objects and registry blobs are not backed up, by decision. They live
only in the R2 buckets `snapflow-objects` and `snapflow-snapshots`, with no
second copy in the cluster or in `snapflow-backups`, so a restore leaves them
as they are and losing either bucket loses its contents.

Redis is not backed up. It holds sessions and the settlement and usage locks,
so losing its volume signs every user out and drops any lock held at that
moment. It runs with
`maxmemory-policy noeviction`, so a full Redis rejects writes instead of
silently evicting a lock.

Alertmanager raises `PostgresBackupStale`, `PostgresBackupFailed`,
`PostgresWalArchivingFailing` and `SnapflowBackupStale` when any of these stop.

## What must be kept off the host

None of these can be read back from R2. The R2 credentials themselves live in
OpenBao, which is inside the backups, so they are needed to start a restore.

- k3s server token (`/var/lib/rancher/k3s/server/token`); etcd snapshots are
  encrypted with it and are useless without it.
- k3s secrets-encryption config
  (`/var/lib/rancher/k3s/server/cred/encryption-config.json`).
- OpenBao static seal key (Secret `openbao/openbao-seal`); raft snapshots
  cannot be unsealed without it.
- R2 backup credentials (Secret `snapflow/snapflow-backups`).

`moon run deploy:recovery-kit` collects all four from the first `server` host
in `deploy/ansible/inventory.yml` into one passphrase-encrypted file. Store one copy in a password manager and one offline,
and make a new kit after rotating any of them. Keep the OpenTofu state
passphrase (`TF_VAR_state_passphrase`) in the same password manager entry; the
state in R2 is unreadable without it.

## Operator secrets

Secrets you supply live in OpenBao under `secret/snapflow/`, one key per field.
Edit them in the UI (`moon run deploy:openbao`, signed in with method Token and
a token from `moon run deploy:openbao-token`), then run
`moon run deploy:sync-secrets`. Every save is a new version that Version
history can restore, and a missing key shows up as a failing ExternalSecret
(`kubectl get externalsecrets -A`).

| Path | Fields |
|---|---|
| `snapflow/api` | `BETTER_AUTH_SECRETS`, `RESEND_API_KEY`, `SNAPFLOW_CLOUDFLARE_API_TOKEN` (DNS and Custom Hostnames edit on the `PLATFORM_DOMAIN` zone), `SNAPFLOW_CLOUDFLARE_WEBHOOK_SECRET`, `SETTLEMENT_RPC_URL` (a Base mainnet endpoint with its provider key), `TURNSTILE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`; optionally `HEALTH_CHECK_API_KEY` |
| `snapflow/worker` | `SETTLEMENT_RELAYER_PRIVATE_KEY` (the claim relayer's gas wallet; only the worker reads it) |
| `snapflow/alerts` | `pushover-token`, `pushover-user-key` (Alertmanager, Flux, settlement and dynamic DNS alerts) |
| `snapflow/backups` | `access-key-id`, `secret-access-key` (R2 S3 credentials) |
| `snapflow/storage` | `api-access-key-id`, `api-secret-access-key` (R2 Object Read & Write on the user-object bucket only); `registry-access-key-id`, `registry-secret-access-key` (the same on the snapshot bucket only) |
| `snapflow/cloudflare-dns` | `api-token` (Zone:DNS:Edit on the `PUBLIC_DOMAIN` and `PLATFORM_DOMAIN` zones: cert-manager DNS-01 and dynamic DNS) |
| `snapflow/edges/<name>` | `id`, `enrollment-secret` (from the edge's enrollment in Admin, Edges) |

The cluster generates `snapflow/platform/postgres-readonly` (the database tools
login) and `snapflow/platform/grafana` (the Grafana admin login); treat them as
read only.

## Restoring on a new server

1. Put the new server in `deploy/ansible/inventory.yml` and run
   `moon run deploy:hosts -- --extra-vars token=<k3s token from the kit>`, then
   stop k3s before its first start completes.
2. Restore the newest etcd snapshot. `--etcd-s3-config-secret` cannot be used
   while restoring, so pass the bucket explicitly with the kit's credentials:
   `k3s server --cluster-reset --etcd-s3 --etcd-s3-endpoint <endpoint>
   --etcd-s3-bucket snapflow-backups --etcd-s3-folder k3s
   --etcd-s3-access-key <id> --etcd-s3-secret-key <secret>
   --cluster-reset-restore-path <snapshot name>`.
   Put the kit's `encryption-config.json` in place first, then start k3s normally.
3. Flux, the operators and every Kubernetes object return from etcd. Volumes do
   not; the next steps refill them.
4. OpenBao: put the seal key back in `openbao/openbao-seal`, then restore the
   newest `openbao/` snapshot with `bao operator raft snapshot restore`.
   External Secrets then repopulates every application secret.
5. Postgres: change `bootstrap` in `platform/data/postgres.yaml` to
   `recovery` from the `snapflow-postgres-backups` ObjectStore (the same
   `externalClusters` block `platform/data/postgres-restore-drill.sh` uses), let Flux create the cluster,
   then switch it back to `initdb` in Git once it is running. Add
   `recoveryTarget.targetTime` to stop before a bad write.
6. Check `moon run deploy:status`, the Grafana dashboards and the external uptime
   probe before reopening sign-ups.

## Rolling back a bad image

Flux image automation (`ImageUpdateAutomation` `flux-system/snapflow`) pins
the newest `build-<sha>-<timestamp>` image of every app into
its `deploy/apps/production/<app>/release.yaml` and pushes that commit to `main`.

1. Stop it pinning newer images: `flux suspend image update snapflow`.
2. Find the last good `tag` and `digest` of the broken app in the automation's
   commits (`git log -p -- deploy/apps/production/<app>/release.yaml`). Put them
   back in a pull request, keeping each line's `# {"$imagepolicy": ...}`
   marker, merge it and run `moon run <app>:deploy`.
3. Never roll the database back. The schema is one init migration applied
   forward by the `snapflow-migrate` pre-upgrade job, so the previous image
   runs against the new schema. If it cannot, do not roll back: ship a fixed
   image whose migration repairs the schema (or restore Postgres to a point
   in time before the bad write, step 5 of the restore above).
4. Resume only after the fix is built from `main`: `flux resume image update
   snapflow`. Resuming earlier pins the broken image again, because it is
   still the newest build.

## Re-enrolling a lost edge

An edge's identity key lives in its state directory
(`/var/lib/snapflow/edge` on the edge's node, owned by uid 65532). If the
directory is lost or the key may have leaked:

1. In the dashboard, open Admin, Edges, and reissue the edge's enrollment
   secret (`POST /admin/edges/<id>/enrollment-secret`). This revokes its
   sessions, bumps its credential generation and returns a one-time secret
   that expires; the edge stops serving until it enrolls again.
2. Store the secret as `enrollment-secret` under `snapflow/edges/<name>`
   (`moon run deploy:openbao` with a token from `moon run deploy:openbao-token`),
   then `moon run deploy:sync-secrets`. Reloader restarts the edge when its
   Secret changes.
3. If the node was rebuilt, keep it in the `edge` group of
   `deploy/ansible/inventory.yml` and run `moon run deploy:hosts`, which
   recreates the state directory. The edge generates a new identity key and
   enrolls with the new secret.
4. Check the edge is `active` in Admin, Edges, and that its `Probe` is green.

A new edge needs an entry in `edges` in `deploy/apps/production/edge/release.yaml`
(`name`, `node` and the `publicHost` the API has for it), its public host in
`EDGE_HOSTS` in `cluster-settings.env`, and the `id` and `enrollment-secret`
from creating it in Admin, Edges stored under `snapflow/edges/<name>`.

### Standalone edges

An edge on a machine outside the cluster runs as the `snapflow-edge` systemd
service, installed from the signed release channel and updated by
`snapflow-edge-update.timer`.

1. Create it in Admin, Edges with that machine's public host, tunnel address
   and port inventory. It does not belong in `EDGE_HOSTS`, which follows this
   cluster's IP.
2. Add the host to the `standalone_edge` group of
   `deploy/ansible/inventory.yml` with `public_ip`,
   `standalone_edge_public_host`, `standalone_edge_id`,
   `host_firewall_exposure_tcp_ranges` and `host_firewall_exposure_udp_ranges`
   (the port inventory as `first:last`), and its host key to
   `deploy/ansible/known_hosts`.
3. Run `moon run deploy:cloudflare`, which creates the edge's DNS-only A record
   from the inventory.
4. Run `SNAPFLOW_EDGE_ENROLLMENT_SECRET=<secret> moon run deploy:hosts -- --limit <host>`.
   The edge fetches its TLS bundle from the API, enrolls and starts serving;
   `snapflow edge status` on the host shows its release.
5. Add `<host tunnel address>` to `ORIGIN_EDGE_TUNNELS` in
   `cluster-settings.env` so the origin connector dials it.

To re-enroll one, reissue its secret as above and run
`SNAPFLOW_EDGE_ENROLLMENT_SECRET=<secret> snapflow edge install --api-url <url> --edge-id <id> --origin-site <site> --origin-hosts <hosts>`
on the host; it rewrites the service settings and restarts the edge. A lost
host is rebuilt with step 4.

## Origin connector

The `origin` app dials every edge in `ORIGIN_EDGE_TUNNELS` as site
`ORIGIN_SITE` and carries the `ORIGIN_HOSTS` connections that edges pass
through by SNI to Traefik's `origin` entrypoint. Edges keep serving with the
TLS bundle they cached even while the API is unreachable, so the control
plane can sit behind them.

To cut `ORIGIN_HOSTS` over to the edges:

1. Set `ORIGIN_EDGE_TUNNELS`, add `origin.yaml` to
   `deploy/clusters/production/apps/kustomization.yaml` and check the
   `origin_sessions` metric on every edge.
2. Point the `ORIGIN_HOSTS` DNS records at the edges as DNS-only records,
   one host at a time, and keep the Cloudflare proxied records ready to
   restore.

If the connector is down, the edges refuse origin connections; restoring
the proxied DNS records is the fallback.

## Image signature webhook

policy-controller admits a `ghcr.io/snapflowio/snapflow/*` image into the
`snapflow` namespace only with a GitHub provenance attestation signed by
`images.yml` on `main`. Its webhook fails closed: while it is down, no pod in
`snapflow` can be created or replaced (running pods keep running). If it blocks a
restore, suspend the `infrastructure-configs` Kustomization with `flux suspend kustomization
infrastructure-configs`, remove the `policy.sigstore.dev/include` label from the `snapflow`
namespace, and resume once policy-controller is healthy; Flux puts the label back.
To check an image by hand: `gh attestation verify oci://<image>@<digest> --repo
snapflowio/snapflow --signer-workflow snapflowio/snapflow/.github/workflows/images.yml`.

## Escrow incidents

The escrow is immutable; every lever below is a call the Safe signs in the Safe
app against `SETTLEMENT_ESCROW_ADDRESS`. Durations are seconds. The admin Safe
holds every role named in brackets unless it has since granted a role to
another address. Platform fees go to a separate treasury Safe, the fee receiver
(`settlement.feeReceiverAddress`); the API sweeps them to it on its own and
withdraws its platform channel earnings once that Safe has called
`setPayoutAddress` with its own address.

- **Stop new money coming in** [pauser]: `pause()`. Deposits, auto top-ups and
  new or raised automatic-payment signers revert; claims, payouts and
  withdrawals keep working, so nobody's funds are trapped. Undo with `unpause()`
  [admin]. The relayer is the escrow's guardian and also holds the pauser role:
  when the settlement operator finds the escrow's USDC balance below
  `totalHeld()`, it pauses deposits on its own and raises `escrow-insolvent`. It
  cannot unpause, so deposits stay stopped until the admin Safe decides.
- **Stop money going to hosts** [claims freezer]: `freezeClaims(duration)`, at
  most 72 hours. Every claim fails as `ClaimsFrozen` and withdrawal unlocks and
  claim deadlines stop counting down while it lasts, so no host loses earnings to
  the freeze. It works once per arming: the admin Safe re-arms it with
  `rearmClaimsFreeze()` 30 days after it began.
- **Freeze one account** [compliance]: `blockAccount(account, reason, duration)`
  with reason `0` (sanctions) or `1` (fraud) and a duration of at most
  `7776000` (90 days); repeat before it lapses to keep it. A blocked account
  cannot deposit, withdraw or be paid, and value sent to it is held as frozen.
  `unblockAccount(account)` lifts it and `releaseFrozen(account)` then credits
  the frozen value back. The `sanctions-match` alert lists the accounts to block.
- **Change the deposit caps** [admin]: `setDepositCaps((total, perAccount))`
  in USDC base units (6 decimals); `0` removes that cap. Check
  `depositCaps()` afterwards; the dashboard reads the new room within a refresh.
- **Recover USDC sent to the escrow by mistake** [admin]:
  `recoverSurplus(to)` moves only the balance above `totalHeld()`.

### Rotating the relayer key

The relayer key pays gas and relay fees and, as the escrow's guardian, may only
pause deposits.

1. Wait until `settlement_transaction` has no `pending` rows, or the replaced
   key will leave stuck nonces behind.
2. Create a new key, store it as `SETTLEMENT_RELAYER_PRIVATE_KEY` under
   `secret/snapflow/`, set `settlement.relayerAddress` in
   `deploy/apps/production/api/release.yaml` to its address, and fund it with ETH
   on Base.
3. From the admin Safe, `grantRole(PAUSER_ROLE(), newRelayer)` and
   `revokeRole(PAUSER_ROLE(), oldRelayer)` so the guardian moves with the key.
4. After Flux rolls the API out, sweep the old key's ETH to the new one.
5. Customers' auto top-ups name the relayer that may run them, so each one stops
   until its customer turns auto top-up on again from the dashboard.

### Moving to a new escrow

1. `pause()` the old escrow so no new deposits arrive.
2. Deploy the new escrow with `DeployEscrow` (see `apps/contracts/moon.yml`),
   with a new salt label in `script/base/EscrowDeployer.sol`, the production
   deposit caps, the admin Safe as `ESCROW_SAFE`, the treasury Safe as
   `ESCROW_FEE_RECEIVER` and the relayer as `ESCROW_GUARDIAN`. The script checks
   both Safes' owners and thresholds on chain and makes the admin Safe admin from
   the first block.
3. Set `settlement.escrowAddress` and `settlement.escrowDeploymentBlock` to the
   new deployment and roll out; the indexer starts from the new block.
4. Old balances stay withdrawable: customers call `requestWithdrawal` then
   `completeWithdrawal`, hosts `withdrawHost`, and the fee receiver
   `sweepFees` on the old escrow directly. Announce the move before step 3,
   because the dashboard only shows the configured escrow.

## Drills

- Monthly, automatically: the `snapflow/postgres-restore-drill` CronJob restores
  the newest backup into a scratch cluster, compares tables, migrations and row
  counts with production, and deletes it; a failed run raises `KubeJobFailed`.
  `moon run deploy:postgres-restore-drill` runs it now and follows the log;
  `RECOVERY_TARGET_TIME=<RFC 3339>` tests point-in-time recovery and
  `KEEP_DRILL_CLUSTER=true` leaves the scratch cluster for inspection.
- After every rotation: make a new recovery kit and confirm it decrypts.
- Twice a year: rehearse the full restore above on a spare machine.
