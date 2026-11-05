#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Opens the cluster's OpenBao web UI on this machine for managing the operator
# secrets listed below (the message this prints). OpenBao is never exposed outside
# the cluster: this forwards its port to localhost and logs in through
# Kubernetes auth as the snapflow-operator role, whose token can edit only the
# operator secrets and expires after an hour. On exit it asks External Secrets
# to sync now instead of at its hourly refresh, and Reloader then restarts only
# the workloads whose secrets changed.

set -euo pipefail

readonly namespace="openbao"
readonly service="openbao"
readonly service_port=8200
readonly local_port=18200
readonly login_role="snapflow-operator"
readonly service_account="snapflow-openbao-operator"
readonly token_audience="openbao"
readonly login_jwt_duration="10m"
readonly ready_attempts=30
readonly ready_interval_seconds=1
readonly address="http://127.0.0.1:${local_port}"

close() {
	kill "${port_forward}" 2>/dev/null || true
	if [[ -n "${token:-}" ]]; then
		kubectl annotate externalsecrets.external-secrets.io --all --all-namespaces \
			"force-sync=$(date +%s)" --overwrite >/dev/null
		echo "Requested an External Secrets sync; changed secrets reach the cluster now."
	fi
}

kubectl --namespace "${namespace}" port-forward "service/${service}" "${local_port}:${service_port}" >/dev/null &
port_forward=$!
trap close EXIT

for ((attempt = 1; attempt <= ready_attempts; attempt++)); do
	curl --silent --fail --output /dev/null "${address}/v1/sys/health" && break
	if ((attempt == ready_attempts)); then
		echo "OpenBao is not reachable or is sealed at ${address}" >&2
		exit 1
	fi
	sleep "${ready_interval_seconds}"
done

jwt="$(kubectl --namespace "${namespace}" create token "${service_account}" \
	--audience "${token_audience}" --duration "${login_jwt_duration}")"
token="$(jq --null-input --arg role "${login_role}" --arg jwt "${jwt}" '{role: $role, jwt: $jwt}' |
	curl --silent --fail --data @- "${address}/v1/auth/kubernetes/login" |
	jq --exit-status --raw-output '.auth.client_token')"

cat <<MESSAGE
OpenBao UI: ${address}/ui/vault/secrets/secret/kv/list/snapflow/
Sign in with method "Token" and this token (valid for one hour):

  ${token}

Secrets you supply, one key per field (Create secret under secret/snapflow/):
  snapflow/api              BETTER_AUTH_SECRETS RESEND_API_KEY SNAPFLOW_CLOUDFLARE_API_TOKEN
                            SNAPFLOW_CLOUDFLARE_WEBHOOK_SECRET STRIPE_SECRET_KEY
                            STRIPE_PUBLISHABLE_KEY STRIPE_PLATFORM_WEBHOOK_SECRET
                            STRIPE_CONNECT_WEBHOOK_SECRET; optionally HEALTH_CHECK_API_KEY
                            GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GITHUB_CLIENT_ID
                            GITHUB_CLIENT_SECRET (the names apps/api/.env uses)
  snapflow/alerts           discord-webhook-url
  snapflow/backups          access-key-id secret-access-key (R2 S3 credentials)
  snapflow/cloudflare-dns   api-token (Zone:DNS:Edit on the public zone)
  snapflow/edges/<name>     id enrollment-secret (from the admin API's edge enrollment)
Read only: snapflow/platform/postgres-readonly (the database tools login).
Every save is a new version; Version history restores earlier values. A
missing key shows up as a failing ExternalSecret (kubectl get externalsecrets -A).

Press Ctrl-C when you are done; your changes are then synced to the cluster.
MESSAGE
wait "${port_forward}" || true
