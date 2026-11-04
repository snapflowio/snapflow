# Production settings

Where every production value lives. There are three homes, split by who sets a value and whether it is secret:

1. **Git**, for everything that is not a secret. Flux applies a change once it is merged into `main` (through `dev`).
2. **OpenBao**, for the secrets the operator supplies, edited in its web UI (`moon run deploy:openbao`, see [deployment.md](../deployment.md#first-installation) step 5).
3. **Generated in the cluster**, for internal credentials nobody types in.

Business settings that change while the platform runs (prices, limits and other knobs) are not deployment configuration: they live in the database's settings system and are changed from the admin side. Every api environment variable is described in [api-environment.md](api-environment.md).

## Git

| File | What it holds |
| --- | --- |
| `deploy/clusters/production/cluster-settings.env` | Values several stages share: `PUBLIC_DOMAIN`, `STORAGE_DOMAIN`, `REGISTRY_DOMAIN`, `PLATFORM_DOMAIN`, `EMAIL_DOMAIN`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`. Flux substitutes them into the `infrastructure-configs`, `platform`, `platform-backups` and `apps` stages. |
| `deploy/apps/production/snapflow.yaml` | Production values of the Snapflow chart: the domains (from the cluster settings), `email.from` and `email.replyTo`, the `edges` list, and the image pins that Flux image automation writes. Anything not set here takes its default. |
| `deploy/charts/snapflow/values.yaml` | Chart defaults: replicas and resources per app, api `logLevel` and `sqlLogLevel`, database pool sizes, bucket names, the OpenBao address and image, and the Postgres, Redis and RustFS service names. Override any of them in `snapflow.yaml` instead of changing the default. |
| `deploy/platform/data/postgres.yaml` | The Postgres cluster: version, storage size, resources, backups and the `snapflow_readonly` role. |
| `deploy/infrastructure/configs/cloudflare-ddns.yaml` | Which records dynamic DNS keeps on the home address, and how often it checks. |
| `deploy/infrastructure/controllers/` | Versions and settings of cert-manager, CloudNativePG, External Secrets, OpenBao, Reloader and Traefik. |
| `deploy/bootstrap/host-firewall.sh` | The server's UFW rules. Applied by hand on the server, not by Flux. |

## OpenBao: operator secrets

Edited in the OpenBao UI under `secret/snapflow/`. External Secrets copies each path into Kubernetes, and Reloader restarts only the workloads whose secrets changed.

| Path | Keys | Used by |
| --- | --- | --- |
| `snapflow/api` | `BETTER_AUTH_SECRETS`, `RESEND_API_KEY`, `SNAPFLOW_CLOUDFLARE_API_TOKEN`, `SNAPFLOW_CLOUDFLARE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PLATFORM_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`; optionally `HEALTH_CHECK_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | api and worker |
| `snapflow/alerts` | `discord-webhook-url` | Flux alerts, dynamic DNS failure notices |
| `snapflow/backups` | `access-key-id`, `secret-access-key` | Postgres, OpenBao, RustFS and k3s backups to R2 |
| `snapflow/cloudflare-dns` | `api-token` (`Zone:DNS:Edit`) | cert-manager certificates, dynamic DNS |
| `snapflow/edges/<name>` | `id`, `enrollment-secret` | that edge |

## Generated in the cluster

Created once by the OpenBao configure job or by an operator, never typed in. Rotating one means deleting it so it is generated again, and restarting what uses it.

| Credential | Where |
| --- | --- |
| api encryption and HMAC keyrings | OpenBao `snapflow/api/encryption-keyring`, `snapflow/api/hmac-keyring` |
| Redis password, RustFS keys, snapshot-manager HTTP secret | OpenBao `snapflow/platform/redis`, `rustfs`, `snapshot-manager` |
| Read-only database login (`snapflow_readonly`) | OpenBao `snapflow/platform/postgres-readonly`, readable in the UI |
| Postgres owner login (`snapflow`) | Kubernetes secret `snapflow-postgres-app`, created by CloudNativePG |
| Tunnel CA and registry signing key | OpenBao PKI and transit mounts |
| OpenBao seal key | Kubernetes secret `openbao/openbao-seal`, created by `moon run deploy:bootstrap`; keep an offline copy |
