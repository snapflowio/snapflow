{{- define "snapflow.databaseEnvironment" -}}
- name: CNPG_DATABASE_URI
  valueFrom:
    secretKeyRef:
      name: {{ printf "%s-app" .Values.database.cluster }}
      key: uri
- name: DATABASE_URL
  value: "$(CNPG_DATABASE_URI)?sslmode=verify-full&sslrootcert=/etc/snapflow/postgres/ca.crt"
- name: DATABASE_POOL_MAX
  value: {{ .Values.database.poolMax | quote }}
- name: DATABASE_POOL_IDLE_TIMEOUT_MS
  value: {{ .Values.database.poolIdleTimeoutMs | quote }}
- name: DATABASE_CONNECTION_TIMEOUT_MS
  value: {{ .Values.database.connectionTimeoutMs | quote }}
- name: LOG_LEVEL
  value: {{ .Values.api.logLevel | quote }}
- name: SQL_LOG_LEVEL
  value: {{ .Values.api.sqlLogLevel | quote }}
- name: SNAPFLOW_ENVIRONMENT
  value: production
{{- end -}}

{{- define "snapflow.apiEnvironment" -}}
{{- $root := .root -}}
{{ include "snapflow.databaseEnvironment" $root }}
- name: SNAPFLOW_PROCESS_ROLE
  value: {{ .role }}
- name: PORT
  value: "3001"
- name: API_URL
  value: {{ include "snapflow.https" (dict "root" $root "key" "public") }}
- name: ADMIN_URL
  value: {{ include "snapflow.https" (dict "root" $root "key" "public") }}
- name: WEBSITE_URL
  value: {{ include "snapflow.https" (dict "root" $root "key" "public") }}
- name: SNAPFLOW_PLATFORM_DOMAIN
  value: {{ required "domains.platform is required" $root.Values.domains.platform | quote }}
- name: SNAPFLOW_TRUSTED_PROXY_CIDRS
  value: {{ $root.Values.clusterPodCidr | quote }}
- name: EMAIL_FROM
  value: {{ required "email.from is required" $root.Values.email.from | quote }}
{{- with $root.Values.email.replyTo }}
- name: EMAIL_REPLY_TO
  value: {{ . | quote }}
{{- end }}
- name: SETTLEMENT_CHAIN_ID
  value: {{ required "settlement.chainId is required" $root.Values.settlement.chainId | int64 | quote }}
- name: SETTLEMENT_ESCROW_ADDRESS
  value: {{ required "settlement.escrowAddress is required" $root.Values.settlement.escrowAddress | quote }}
- name: SETTLEMENT_ESCROW_DEPLOYMENT_BLOCK
  value: {{ required "settlement.escrowDeploymentBlock is required" $root.Values.settlement.escrowDeploymentBlock | int64 | quote }}
- name: SETTLEMENT_USDC_ADDRESS
  value: {{ required "settlement.usdcAddress is required" $root.Values.settlement.usdcAddress | quote }}
- name: REOWN_PROJECT_ID
  value: {{ required "settlement.reownProjectId is required" $root.Values.settlement.reownProjectId | quote }}
- name: SNAPFLOW_VAULT_PROXY_URL
  value: http://127.0.0.1:8100
- name: SNAPFLOW_SNAPSHOT_MANAGER_URL
  value: {{ printf "%s:%d" (include "snapflow.https" (dict "root" $root "key" "registry")) (int $root.Values.directHttpsPort) | quote }}
- name: SNAPFLOW_GEOIP_DATABASE_PATH
  value: {{ $root.Values.api.geoIpDatabasePath | quote }}
- name: REDIS_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ $root.Values.redis.secret }}
      key: password
- name: REDIS_URL
  value: {{ printf "redis://:$(REDIS_PASSWORD)@%s:6379" $root.Values.redis.service | quote }}
- name: S3_ENDPOINT
  value: {{ printf "%s:%d" (include "snapflow.https" (dict "root" $root "key" "storage")) (int $root.Values.directHttpsPort) | quote }}
- name: S3_REGION
  value: {{ $root.Values.objectStorage.region | quote }}
- name: S3_DEFAULT_BUCKET
  value: {{ $root.Values.objectStorage.bucket | quote }}
- name: S3_ACCESS_KEY
  valueFrom:
    secretKeyRef:
      name: {{ $root.Values.objectStorage.secret }}
      key: access-key
- name: S3_SECRET_KEY
  valueFrom:
    secretKeyRef:
      name: {{ $root.Values.objectStorage.secret }}
      key: secret-key
{{- end -}}
