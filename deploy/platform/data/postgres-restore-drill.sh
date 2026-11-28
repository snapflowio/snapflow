#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

readonly namespace="${DRILL_NAMESPACE:?}"
readonly source_cluster="snapflow-postgres"
readonly drill_cluster="snapflow-postgres-drill"
readonly object_store="snapflow-postgres-backups"
readonly database="snapflow"
readonly plugin="barman-cloud.cloudnative-pg.io"
readonly storage_size="20Gi"
readonly ready_timeout="60m"
readonly cleanup_timeout="10m"
readonly target_time="${RECOVERY_TARGET_TIME:-}"
readonly keep="${KEEP_DRILL_CLUSTER:-false}"
readonly source_ca="${SOURCE_CA_FILE:?}"
readonly drill_ca="${TMPDIR:-/tmp}/drill-ca.crt"
readonly tables_query="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
readonly migrations_query="SELECT name FROM mikro_orm_migrations ORDER BY name"
readonly recovery_point_query="SELECT COALESCE(pg_last_xact_replay_timestamp()::text, 'not replaying WAL')"

cleanup() {
	if [[ "${keep}" == true ]]; then
		echo "Kept ${drill_cluster}; delete it with: kubectl -n ${namespace} delete cluster ${drill_cluster}"
		return
	fi
	kubectl --namespace "${namespace}" delete cluster "${drill_cluster}" --ignore-not-found --wait=true --timeout="${cleanup_timeout}" >/dev/null
	echo "Deleted ${drill_cluster} and its volume"
}

secret_field() {
	kubectl --namespace "${namespace}" get secret "$1" --output "jsonpath={.data.$2}" | base64 --decode
}

source_query() {
	PGPASSWORD="${SOURCE_PASSWORD:?}" psql --no-psqlrc --no-align --tuples-only \
		"host=${source_cluster}-r dbname=${database} user=${SOURCE_USER:?} sslmode=verify-full sslrootcert=${source_ca}" \
		--command "$1"
}

drill_query() {
	PGPASSWORD="${drill_password}" psql --no-psqlrc --no-align --tuples-only \
		"host=${drill_cluster}-rw dbname=${database} user=${drill_user} sslmode=verify-full sslrootcert=${drill_ca}" \
		--command "$1"
}

image="$(kubectl --namespace "${namespace}" get cluster "${source_cluster}" --output 'jsonpath={.spec.imageName}')"
recovery_target=""
if [[ -n "${target_time}" ]]; then
	recovery_target="      recoveryTarget:
        targetTime: \"${target_time}\""
fi

trap cleanup EXIT
kubectl apply --filename - <<MANIFEST
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ${drill_cluster}
  namespace: ${namespace}
spec:
  instances: 1
  imageName: ${image}
  enablePDB: false
  enableSuperuserAccess: false
  storage:
    size: ${storage_size}
  bootstrap:
    recovery:
      source: ${source_cluster}
      database: ${database}
      owner: ${database}
${recovery_target}
  externalClusters:
    - name: ${source_cluster}
      plugin:
        name: ${plugin}
        parameters:
          barmanObjectName: ${object_store}
          serverName: ${source_cluster}
MANIFEST

started="$(date +%s)"
echo "Restoring ${source_cluster} from R2 into ${drill_cluster}; this waits up to ${ready_timeout}"
kubectl --namespace "${namespace}" wait "cluster/${drill_cluster}" --for=condition=Ready --timeout="${ready_timeout}"
echo "Restore finished in $(($(date +%s) - started)) seconds"

drill_user="$(secret_field "${drill_cluster}-app" username)"
drill_password="$(secret_field "${drill_cluster}-app" password)"
secret_field "${drill_cluster}-ca" 'ca\.crt' >"${drill_ca}"

echo "Recovery point: $(drill_query "${recovery_point_query}")"

source_tables="$(source_query "${tables_query}")"
drill_tables="$(drill_query "${tables_query}")"
if [[ "${source_tables}" != "${drill_tables}" ]]; then
	echo "The restored database has different tables:" >&2
	diff <(echo "${source_tables}") <(echo "${drill_tables}") >&2 || true
	exit 1
fi
if [[ "$(source_query "${migrations_query}")" != "$(drill_query "${migrations_query}")" ]]; then
	echo "The restored database has a different migration history" >&2
	exit 1
fi

printf '%-48s %14s %14s\n' "table" "production" "restored"
empty_restore=true
while read -r table; do
	count_query="SELECT count(*) FROM \"${table}\""
	source_count="$(source_query "${count_query}")"
	drill_count="$(drill_query "${count_query}")"
	if ((drill_count > 0)); then
		empty_restore=false
	fi
	printf '%-48s %14s %14s\n' "${table}" "${source_count}" "${drill_count}"
done <<<"${drill_tables}"

if [[ "${empty_restore}" == true ]]; then
	echo "Every restored table is empty; the backup did not carry data" >&2
	exit 1
fi
echo "Restore drill passed: the schema and migrations match and data was restored. Row counts can trail production by the writes since the recovery point."
