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
- name: METRICS_PORT
  value: {{ $root.Values.metrics.port | quote }}
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
  value: {{ prepend $root.Values.cloudflareProxyCidrs $root.Values.clusterPodCidr | join "," | quote }}
- name: EMAIL_FROM
  value: {{ required "email.from is required" $root.Values.email.from | quote }}
- name: EMAIL_REPLY_TO
  value: {{ required "email.replyTo is required" $root.Values.email.replyTo | quote }}
{{- with $root.Values.analytics.posthog }}
{{- if or .projectKey .host }}
- name: POSTHOG_PROJECT_KEY
  value: {{ required "analytics.posthog.projectKey is required when analytics.posthog.host is set" .projectKey | quote }}
- name: POSTHOG_HOST
  value: {{ required "analytics.posthog.host is required when analytics.posthog.projectKey is set" .host | quote }}
{{- end }}
{{- end }}
- name: TURNSTILE_SITE_KEY
  value: {{ required "humanVerification.turnstileSiteKey is required" $root.Values.humanVerification.turnstileSiteKey | quote }}
- name: SETTLEMENT_ALERTMANAGER_URL
  value: {{ $root.Values.alertmanager.url | quote }}
- name: SETTLEMENT_CHAIN_ID
  value: {{ required "settlement.chainId is required" $root.Values.settlement.chainId | int64 | quote }}
- name: SETTLEMENT_ESCROW_ADDRESS
  value: {{ required "settlement.escrowAddress is required" $root.Values.settlement.escrowAddress | quote }}
- name: SETTLEMENT_ESCROW_DEPLOYMENT_BLOCK
  value: {{ required "settlement.escrowDeploymentBlock is required" $root.Values.settlement.escrowDeploymentBlock | int64 | quote }}
{{- with $root.Values.settlement.logBlockRange }}
- name: SETTLEMENT_LOG_BLOCK_RANGE
  value: {{ . | int64 | quote }}
{{- end }}
{{- with $root.Values.settlement.indexerRangesPerRun }}
- name: SETTLEMENT_INDEXER_RANGES_PER_RUN
  value: {{ . | int64 | quote }}
{{- end }}
- name: SETTLEMENT_USDC_ADDRESS
  value: {{ required "settlement.usdcAddress is required" $root.Values.settlement.usdcAddress | quote }}
- name: SETTLEMENT_RELAYER_ADDRESS
  value: {{ required "settlement.relayerAddress is required" $root.Values.settlement.relayerAddress | quote }}
- name: SETTLEMENT_FEE_RECEIVER_ADDRESS
  value: {{ required "settlement.feeReceiverAddress is required" $root.Values.settlement.feeReceiverAddress | quote }}
{{- with $root.Values.settlement.ethUsdFeedAddress }}
- name: SETTLEMENT_ETH_USD_FEED_ADDRESS
  value: {{ . | quote }}
{{- end }}
{{- with $root.Values.settlement.walletConnectProjectId }}
- name: WALLETCONNECT_PROJECT_ID
  value: {{ . | quote }}
{{- end }}
{{- with $root.Values.receipts.issuer }}
- name: RECEIPT_ISSUER_NAME
  value: {{ required "receipts.issuer.name is required" .name | quote }}
- name: RECEIPT_ISSUER_ADDRESS
  value: {{ required "receipts.issuer.address is required" .address | quote }}
- name: RECEIPT_ISSUER_EMAIL
  value: {{ required "receipts.issuer.email is required" .email | quote }}
{{- with .taxId }}
- name: RECEIPT_ISSUER_TAX_ID
  value: {{ . | quote }}
{{- end }}
{{- end }}
- name: SNAPFLOW_VAULT_PROXY_URL
  value: http://127.0.0.1:8100
- name: SNAPFLOW_SNAPSHOT_MANAGER_URL
  value: {{ include "snapflow.https" (dict "root" $root "key" "registry") | quote }}
- name: SNAPFLOW_GEOIP_DATABASE_PATH
  value: {{ $root.Values.api.geoIpDatabasePath | quote }}
- name: SNAPFLOW_EDGE_TLS_CERTIFICATE_FILE
  value: /etc/snapflow/edge-tls/fullchain.pem
- name: SNAPFLOW_EDGE_TLS_PRIVATE_KEY_FILE
  value: /etc/snapflow/edge-tls/private-key.pem
- name: SNAPFLOW_EDGE_TUNNEL_CLIENT_CA_FILE
  value: /etc/snapflow/edge-tls/tunnel-client-ca.pem
- name: SNAPFLOW_EDGE_ORIGIN_CLIENT_CA_FILE
  value: /etc/snapflow/edge-tls/origin-client-ca.pem
- name: REDIS_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ $root.Values.redis.secret }}
      key: password
- name: REDIS_URL
  value: {{ printf "redis://:$(REDIS_PASSWORD)@%s:6379" $root.Values.redis.service | quote }}
- name: S3_ENDPOINT
  value: {{ required "objectStorage.endpoint is required" $root.Values.objectStorage.endpoint | quote }}
- name: S3_REGION
  value: {{ $root.Values.objectStorage.region | quote }}
- name: S3_DEFAULT_BUCKET
  value: {{ required "objectStorage.bucket is required" $root.Values.objectStorage.bucket | quote }}
- name: S3_ACCESS_KEY
  valueFrom:
    secretKeyRef:
      name: {{ $root.Values.objectStorage.apiSecret }}
      key: access-key-id
- name: S3_SECRET_KEY
  valueFrom:
    secretKeyRef:
      name: {{ $root.Values.objectStorage.apiSecret }}
      key: secret-access-key
{{- end -}}
