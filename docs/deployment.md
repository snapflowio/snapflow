# Deployment

Snapflow runs on [k3s](https://k3s.io) and is deployed with [Flux](https://fluxcd.io) (GitOps): the cluster pulls this repository and converges on what `main` describes. Every deployment operation is a [moon](https://moonrepo.dev) task, locally and in CI.

## Architecture

| Component | Role |
| --- | --- |
| k3s | Kubernetes, single control plane with embedded etcd (`cluster-init`), secrets encrypted at rest, WireGuard between nodes |
| Flux | Applies `deploy/` from `main`; image automation pins new images by digest |
| OpenBao | The only secrets store. Self-initialises, auto-unseals with a static seal key, holds every application secret, the api keyrings and the tunnel PKI |
| External Secrets Operator | Syncs OpenBao secrets into Kubernetes Secrets |
| Reloader | Rolls workloads when their secrets or config change |
| CloudNativePG | Postgres with operator-managed TLS (`sslmode=verify-full`) |
| Redis, RustFS | StatefulSets for locks and caches, and S3-compatible object storage |
| cert-manager | Let's Encrypt certificates through Cloudflare DNS validation |
| Traefik (k3s) | Cluster ingress on port `9443` (`traefik-direct`); ports 80 and 443 stay free for the edge |

### Traffic

The machine has one public IP, and the edge owns ports 80, 443 and 8443 for sandboxes. Everything else reaches Traefik on `9443`.

| Host | Path to the cluster |
| --- | --- |
| `snapflow.io` (`/`, `/dashboard`, `/api`) | Cloudflare proxy (orange cloud) → an Origin Rule rewrites the destination port to `9443` → Traefik. Visitors use plain `https://snapflow.io`; Traefik trusts `X-Forwarded-For` only from Cloudflare's address ranges. |
| `*.snapflow.run` (sandboxes) | One proxied CNAME per exposure, created by the api, pointing at the edge that holds the sandbox's machine tunnel. The edge accepts these hosts only through Cloudflare authenticated origin pulls. |
| Edge public host (for example `edge-home.snapflow.run`), machine tunnel `:8443` | DNS only → edge on the host network (real client addresses) |
| `registry.snapflow.io:9443`, `storage.snapflow.io:9443` | DNS only → Traefik. Not proxied because Cloudflare limits request bodies to 100 MB and snapshot layers are larger. |

### Repository layout

```
docker-bake.hcl                  image build graph for the five deployable apps
deploy/
  bootstrap/install-k3s.sh       installs a node (server, server-edge or edge)
  clusters/production/           Flux entry point: stages and cluster-settings.env
  infrastructure/controllers/    cert-manager, CloudNativePG and its Barman Cloud plugin, ESO, OpenBao, Reloader, Traefik config
  infrastructure/configs/        Let's Encrypt issuer, the OpenBao ClusterSecretStore and Flux alerts
  platform/openbao-configure/    idempotent job that reconciles OpenBao from Git
  platform/data/                 Postgres (with its backups), Redis, RustFS and their secrets
  platform/jobs/                 object storage buckets
  platform/backups/              OpenBao, RustFS and k3s backups to R2
  apps/production/               the Snapflow HelmRelease and its pinned image digests
  images/                        Flux image repositories, policies and update automation
  charts/snapflow/               Helm chart for api, worker, dashboard, marketing, snapshot-manager and edges
  components/                    shared kustomize components (HelmRelease defaults)
  scripts/                       scripts behind the moon tasks
```

Flux applies the stages in order: `infrastructure-controllers` → `openbao-configure` → `infrastructure-configs` → `platform` → `platform-jobs` → `platform-backups` and `apps`. `images` runs alongside once the secret store is ready.

## Tasks

| Task | What it does |
| --- | --- |
| `moon run deploy:validate` | Lints the chart, validates every stage against the Kubernetes and CRD schemas, and shellchecks the scripts (runs in CI) |
| `moon run <app>:image` | Builds the app image into the local Docker engine |
| `moon run <app>:publish` | Typechecks, lints, validates, builds, scans with Trivy, and only then tags `build-<sha>-<timestamp>`; the commit must be on `dev` |
| `moon run deploy:bootstrap` | Creates the OpenBao seal key if missing and bootstraps Flux |
| `moon run deploy:openbao` | Opens the OpenBao web UI on `localhost:18200` and prints a one-hour token for managing the operator secrets |
| `moon run deploy:reconcile` | Makes Flux pull `main` and apply every stage now |
| `moon run deploy:status` | Shows every Flux stage, Helm release and image policy |

Images are built once, from `dev`, and production runs exactly those images:

1. A merge into `dev` runs CI and then the same `<app>:publish` task in GitHub Actions for every app it changed (`dev.yml` calls `ci.yml` and `images.yml`), and attests the image.
2. Within five minutes Flux image automation commits the new digest to `deploy/apps/production` on `dev`. It authenticates as the `snapflowio-automation` GitHub App, the only actor the `dev` ruleset lets push directly. That commit changes only the pinned manifests, so it starts neither CI nor another image build.
3. Promoting `dev` to `main` carries the pinned digests into production, and Flux deploys them. Nothing writes `main` directly.

Machine releases (the Snapflow runtime, its installer and the TUF repository at `releases.snapflow.io`) are described in [releases.md](releases.md).

## First installation

1. **Cloudflare**
   - `snapflow.io`: an A record to your public IP, proxied (orange cloud). Add an Origin Rule that matches the hostname `snapflow.io` and overrides the destination port to `9443`, set SSL/TLS to *Full (strict)* and turn on *Always Use HTTPS*.
   - `registry` and `storage`: A records to your public IP, DNS only (grey cloud). These three records are kept on the connection's current address by [dynamic DNS](#dynamic-dns), so a changed home IP needs no action.
   - `snapflow.run`, the sandbox zone from `PLATFORM_DOMAIN`: a separate registrable domain, so code running in a sandbox never shares a browser site with the dashboard or the api (the api refuses to start otherwise). Add an A record for each edge's public host, DNS only. Under *SSL/TLS > Custom Hostnames* set that host as the fallback origin, and turn on *Authenticated Origin Pulls*. The api creates every sandbox CNAME itself.
   - Create an API token with `Zone:DNS:Edit` on both zones for certificates, and give `SNAPFLOW_CLOUDFLARE_API_TOKEN` DNS and custom hostname access to the sandbox zone.
   - Email: add the sending domain from `EMAIL_DOMAIN` in `cluster-settings.env` (`mail.snapflow.io`) under *Domains* in [Resend](https://resend.com/domains) and copy its records into the zone, all DNS only: the DKIM `TXT` record `resend._domainkey.mail`, and the `MX` (priority 10) and SPF `TXT` records on `send.mail` that Resend uses as the bounce (Return-Path) domain. Add a DMARC `TXT` record on `_dmarc` (start with `v=DMARC1; p=none;` and tighten it once reports are clean), then press *Verify* in Resend or run `resend domains verify <id>` with the [Resend CLI](https://resend.com/docs/cli). Create an API key with *Sending access* restricted to that domain for `RESEND_API_KEY`. The api sends from `Snapflow <noreply@${EMAIL_DOMAIN}>` (Helm value `email.from`); set `email.replyTo` in `deploy/apps/production/snapflow.yaml` to route replies to a monitored mailbox.
2. **Router**: give the machine a fixed LAN address (a DHCP reservation), and forward TCP 80, 443, 8443 and UDP 8443 (edge), and TCP 9443 (site, registry and storage) to it. Forward nothing else; SSH and the k3s API stay on the local network.
3. **k3s**: `sudo PUBLIC_IP=<public ip> deploy/bootstrap/install-k3s.sh server-edge` (the API is advertised on the address of the default route; set `NODE_IP` to pick another), then copy `/etc/rancher/k3s/k3s.yaml` to your workstation's kubeconfig and replace `127.0.0.1` with the machine's address. Then apply the [host firewall](#host-firewall).
4. **Flux**: `SNAPFLOW_AUTOMATION_PRIVATE_KEY_FILE=<path to the snapflowio-automation App private key> moon run deploy:bootstrap`. It installs the [Flux Operator](https://fluxcd.control-plane.io/operator/), stores the App key in the `flux-system` secret (the only copy outside your password manager), and applies the `FluxInstance` in `deploy/clusters/production/flux-system`, which syncs `main` as the App; no deploy key is created. From then on Flux manages the operator and itself from Git. Back up the printed OpenBao seal key offline; it decrypts everything in OpenBao.
5. **Secrets**: run `moon run deploy:openbao`, open the printed URL and sign in with method *Token* and the printed token. Under `secret/snapflow/`, create each secret below with *Create secret*, one key per field. Press Ctrl-C in the terminal when you are done, which asks External Secrets to sync the changes now.

   | OpenBao path | Keys |
   | --- | --- |
   | `snapflow/api` | `BETTER_AUTH_SECRETS`, `RESEND_API_KEY`, `SNAPFLOW_CLOUDFLARE_API_TOKEN`, `SNAPFLOW_CLOUDFLARE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PLATFORM_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, and optionally `HEALTH_CHECK_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (same names as `apps/api/.env`) |
   | `snapflow/alerts` | `discord-webhook-url` (a Discord channel webhook, see [Alerts](#alerts)) |
   | `snapflow/backups` | `access-key-id`, `secret-access-key` (the R2 S3 credentials, see [Backups](#backups)) |
   | `snapflow/cloudflare-dns` | `api-token` (the `Zone:DNS:Edit` token) |
   | `snapflow/edges/<name>` | `id`, `enrollment-secret` (step 6) |

   Only secrets go in OpenBao; every other api setting comes from the Helm chart. The UI token can create, edit, roll back and delete only these paths, read the [read-only database login](#querying-the-database), and expires after an hour; OpenBao is never exposed outside the cluster. Every save is a new version, so *Version history* shows and restores earlier values. A missing or misspelled key shows up as a failing ExternalSecret (`kubectl get externalsecrets -A`) and a Flux alert. Everything else (api keyrings; Postgres, Redis, RustFS and snapshot-manager credentials; the tunnel CA) is generated in the cluster, and Cloudflare's public origin pull CA ships with the chart. Keep a copy of these values in your password manager.
6. **Edge**: register the edge with the admin API (`POST /api/admin/edges`, then `POST /api/admin/edges/:id/enrollment-secret`), store its `id` and `enrollment-secret` at `snapflow/edges/home` in the OpenBao UI, and add `{name: home, node: <k3s node name>}` to `edges` in `deploy/apps/production/snapflow.yaml`.

7. **Public images**: the images are public, like the source, so neither the cluster nor Flux needs a registry token. After the first publish, open each package under the organization's *Packages* (`snapflow/api`, `snapflow/dashboard`, `snapflow/marketing`, `snapflow/snapshot-manager`, `snapflow/edge`) and set *Package settings > Change visibility* to *Public* (the organization must allow public packages under *Settings > Packages*).

Flux keeps retrying each stage until its prerequisites exist, so the order of steps 5 and 6 does not matter.

### Database migrations

The migration Job runs as a Helm pre-upgrade hook, so the new schema is in place before the new code starts and while the previous code is still serving. Every migration must therefore keep working with the release before it (expand and contract): add columns and tables in one release, start using them in the next, and drop what the old code needed only once no release uses it. The production `snapflow` release retries a failed upgrade instead of rolling back, because a rollback would run the previous code against a schema the migration already changed.

### Sandbox domain isolation

Every sandbox host serves code its owner controls, including the system toolbox, terminal and desktop. Isolation comes from four layers:

- The sandbox zone is its own registrable domain, so sandbox pages are cross-site to `snapflow.io`.
- The edge removes the `Domain` attribute from every cookie a sandbox sets, and drops cookies that would shadow its own `__Host-Snapflow-Access-v1-` session cookies.
- Dashboard and api session cookies use the `__Host-` prefix, and the api refuses state-changing session requests from untrusted origins.
- File the sandbox zone with the [Public Suffix List](https://github.com/publicsuffix/list) (private section). Once browsers ship the entry, each sandbox host is its own site, isolated from every other sandbox as well.

## Operations

- **Rotate a secret**: open `moon run deploy:openbao`, edit the secret and save it as a new version, then press Ctrl-C; External Secrets syncs at once and Reloader rolls only the workloads whose secrets changed. To retire an edge, remove it from the chart, then delete `snapflow/edges/<name>` in the UI (*Delete metadata and all versions*).
- **Roll back an app**: on a `hotfix/<name>` branch from `main`, set the app's `tag` and `digest` in `deploy/apps/production/snapflow.yaml` back to the previous pins (or revert the promotion), and merge it into `main`. Image automation never writes `main`, so the rollback stays until the next promotion, which should carry the fix. Database migrations are forward-only.
- **Change settings**: edit `deploy/clusters/production/cluster-settings.env` or the chart values in Git; Flux applies the change.
- **Upgrade platform components**: bump the pinned chart and image versions in `deploy/` and run `moon run deploy:validate`.
- **Upgrade k3s**: rerun `install-k3s.sh` with a newer `k3s_version`.
- **Add an edge server**: install it with `install-k3s.sh edge` (it joins over WireGuard and is tainted for the edge only), then add its OpenBao secret and `edges` entry as in step 6.
- **Backups and restores**: see [Backups](#backups).

### Host firewall

`deploy/bootstrap/host-firewall.sh` is the server's whole UFW configuration: each run resets UFW and applies the same rules, so running it again changes nothing and removes anything added by hand. The edge ports (TCP 80, 443 and 8443, UDP 8443) and Traefik (TCP 9443) are public; SSH (rate limited) and the k3s API accept only the administrative network, by default the network of the default route, plus Tailscale when the machine runs it; the k3s pod and service networks are allowed as k3s requires. Preview it with `--dry-run`, then apply it on the server:

```sh
ssh -t <server> 'sudo bash -s' < deploy/bootstrap/host-firewall.sh
```

Set `ADMIN_CIDR` (for example `sudo ADMIN_CIDR=192.168.40.0/24 bash -s`) to choose the administrative network. Docker-published ports and Kubernetes NodePort, LoadBalancer and host-network ports bypass UFW, so the script ends by listing every such port; only Traefik's 9443 and the edge should appear. The router's port forwards remain the outer boundary.

### Dynamic DNS

`deploy/infrastructure/configs/cloudflare-ddns.yaml` runs [cloudflare-ddns](https://github.com/favonia/cloudflare-ddns), which checks the connection's public IPv4 address every five minutes and on start, and points `PUBLIC_DOMAIN` (proxied), `REGISTRY_DOMAIN` and `STORAGE_DOMAIN` (DNS only) at it. It deploys in the `infrastructure-configs` stage, before the platform and apps, uses the `snapflow/cloudflare-dns` token, and reports failed updates to the alerts Discord channel. Check it with `kubectl -n cloudflare-ddns logs deploy/cloudflare-ddns`.

### Querying the database

Postgres has no public port. Database tools connect as `snapflow_readonly`, a login that can read every table and change nothing (PostgreSQL's `pg_read_all_data`); its password is generated in OpenBao at `snapflow/platform/postgres-readonly`, which the OpenBao UI shows. The `snapflow` owner login is for the api only.

In DataGrip (or any client with an SSH tunnel):

- **SSH/SSL**: tunnel through the server with your SSH key.
- **Host**: the address of the primary's service, `kubectl -n snapflow get service snapflow-postgres-rw -o jsonpath='{.spec.clusterIP}'` (stable while the cluster exists); **Port** `5432`; **Database** `snapflow`; **User** `snapflow_readonly`.

Without a tunnel, `kubectl -n snapflow port-forward service/snapflow-postgres-rw 5432:5432` serves it on `localhost:5432` while it runs.

### Alerts

Flux reports every failed reconciliation (sources, stages, Helm releases and image automation, in every namespace that holds Flux objects) to Discord, and posts the result of each stage for the synced `main` commit to GitHub as a commit status. Both are in `deploy/infrastructure/configs/notifications.yaml`; a new namespace with Flux objects must be added to its `flux-errors` Alert. The Discord webhook is `discord-webhook-url` in `snapflow/alerts` (channel settings > Integrations > Webhooks > New Webhook > Copy Webhook URL); rotate it by replacing the webhook and saving the new URL in the OpenBao UI. Commit statuses are posted as the `snapflowio-automation` GitHub App, which needs the *Commit statuses: Read and write* repository permission.

### Backups

Everything that cannot be rebuilt from Git is copied to the Cloudflare R2 bucket `snapflow-backups` (`BACKUP_S3_ENDPOINT` and `BACKUP_S3_BUCKET` in `cluster-settings.env`):

| What | How | Schedule | Kept | Location in the bucket |
| --- | --- | --- | --- | --- |
| Postgres | CloudNativePG [Barman Cloud plugin](https://cloudnative-pg.io/plugin-barman-cloud/): continuous WAL archiving and a base backup | WAL continuously, base backup daily at 03:00 | 30-day recovery window | `postgres/` |
| OpenBao | `bao operator raft snapshot save` | daily at 03:30 | 30 days | `openbao/` |
| RustFS (volume backups, sandbox snapshots) | `rclone sync` of both buckets; objects it would delete or overwrite move to `rustfs-changes/<date>/` | daily at 04:00 | mirror, plus 30 days of changes | `rustfs/`, `rustfs-changes/` |
| k3s (etcd) | k3s etcd snapshots, uploaded with the local copy | every six hours | 28 snapshots (7 days) | `k3s/` |

Credentials: on the R2 overview page, *Manage API tokens > Create Account API token* with *Object Read & Write* on `snapflow-backups` only. Cloudflare shows the S3 *Access Key ID* and *Secret Access Key* once, on creation; save them in `snapflow/backups` as `access-key-id` and `secret-access-key`. (They can also be derived from the token: the access key ID is the token's ID and the secret access key is the SHA-256 hex digest of the token value.) Keep them, the OpenBao seal key, the k3s server token (`/var/lib/rancher/k3s/server/token`) and the operator secrets from step 5 in your password manager: no backup can be restored without them. A failed backup Job or a failing WAL archive shows up as a Flux or CloudNativePG error; check `kubectl get backups,scheduledbackups -n snapflow` and the CronJobs after any change.

Test a restore every quarter. Restore order after losing the machine: k3s, then OpenBao, then Postgres and RustFS.

- **k3s**: install k3s with `install-k3s.sh`, stop it, and restore a snapshot from R2, passing the S3 settings on the command line (the in-cluster S3 secret is not available during a restore): `k3s server --cluster-reset --etcd-s3 --etcd-s3-endpoint=<account>.r2.cloudflarestorage.com --etcd-s3-region=auto --etcd-s3-bucket=snapflow-backups --etcd-s3-folder=k3s --etcd-s3-access-key=<id> --etcd-s3-secret-key=<secret> --cluster-reset-restore-path=<snapshot name>`, with the original server token in place. Then start k3s again.
- **OpenBao**: on a fresh cluster, create the `openbao-seal` secret from your backed-up seal key before OpenBao starts (`bootstrap-flux.sh` would otherwise generate a new one), then copy a snapshot from `openbao/` and run `bao operator raft snapshot restore -force <file>` with a root or sufficiently privileged token. Snapshots are encrypted with the seal key, so the original key is required.
- **Postgres**: create a new Cluster that bootstraps from the object store, as in the [plugin's restore guide](https://cloudnative-pg.io/plugin-barman-cloud/docs/usage/#restoring-a-cluster): `bootstrap.recovery.source` pointing at an `externalClusters` entry with `plugin.name: barman-cloud.cloudnative-pg.io`, `parameters.barmanObjectName: snapflow-postgres-backups` and `serverName: snapflow-postgres`, and optionally `recoveryTarget.targetTime` for a point in time. Write new WAL to a fresh path (a second ObjectStore) so the restored cluster does not overwrite the history it came from. If R2 rejects uploads with an `x-amz-content-sha256` error, set `AWS_REQUEST_CHECKSUM_CALCULATION` and `AWS_RESPONSE_CHECKSUM_VALIDATION` to `when_required` in the ObjectStore's `instanceSidecarConfiguration.env`, as the plugin documents.
- **RustFS**: `rclone sync r2:snapflow-backups/rustfs/<bucket> rustfs:<bucket>` for `snapflow` and `snapflow-snapshots`; an object deleted or overwritten in the last 30 days is under `rustfs-changes/<date>/<bucket>/`.

## Third-party data

The api image ships the [DB-IP](https://db-ip.com) City Lite database, which locates machines and the callers placing sandboxes. It is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): pages that show locations derived from it must credit DB-IP with a link to https://db-ip.com. The image build downloads the current monthly edition, so rebuild the api image at least monthly to keep locations accurate.
