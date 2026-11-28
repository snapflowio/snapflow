{{- define "snapflow.labels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/part-of: snapflow
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end -}}

{{- define "snapflow.selectorLabels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}

{{- define "snapflow.image" -}}
{{- $repository := printf "ghcr.io/%s/%s" (required "imageNamespace is required" .root.Values.imageNamespace) .name -}}
{{- $tag := required "image.tag is required" .root.Values.image.tag -}}
{{- if .root.Values.image.digest -}}
{{ printf "%s:%s@%s" $repository $tag .root.Values.image.digest }}
{{- else -}}
{{ printf "%s:%s" $repository $tag }}
{{- end -}}
{{- end -}}

{{- define "snapflow.podSecurityContext" -}}
runAsNonRoot: true
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{- define "snapflow.containerSecurityContext" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop:
    - ALL
{{- end -}}

{{- define "snapflow.https" -}}
{{ printf "https://%s" (required (printf "domains.%s is required" .key) (index .root.Values.domains .key)) }}
{{- end -}}

{{- define "snapflow.ingressNetworkPolicy" -}}
{{- $ingress := .root.Values.networkPolicy.ingressController -}}
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ printf "snapflow-%s-ingress" .component }}
  labels:
    {{- include "snapflow.labels" (dict "root" .root "component" .component) | nindent 4 }}
spec:
  podSelector:
    matchLabels:
      {{- include "snapflow.selectorLabels" (dict "root" .root "component" .component) | nindent 6 }}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: {{ $ingress.namespace }}
          podSelector:
            matchLabels:
              {{- toYaml $ingress.podLabels | nindent 14 }}
      ports:
        - protocol: TCP
          port: {{ .port }}
{{- end -}}

{{- define "snapflow.probe" -}}
apiVersion: monitoring.coreos.com/v1
kind: Probe
metadata:
  name: {{ .name }}
  labels:
    {{- include "snapflow.labels" (dict "root" .root "component" .component) | nindent 4 }}
spec:
  jobName: {{ .job }}
  interval: {{ .root.Values.probes.interval }}
  module: {{ .module }}
  prober:
    url: {{ .root.Values.probes.proberUrl }}
  targets:
    staticConfig:
      static:
        - {{ .url | quote }}
      labels:
        {{- toYaml .labels | nindent 8 }}
{{- end -}}

{{- define "snapflow.alertRules" -}}
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: {{ printf "snapflow-%s" .component }}
  labels:
    {{- include "snapflow.labels" (dict "root" .root "component" .component) | nindent 4 }}
spec:
  {{- .root.Files.Get (printf "alerts/%s.yaml" .component) | nindent 2 }}
{{- end -}}

{{- define "snapflow.podDisruptionBudget" -}}
{{- if gt (int .replicas) 1 }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ printf "snapflow-%s" .component }}
  labels:
    {{- include "snapflow.labels" (dict "root" .root "component" .component) | nindent 4 }}
spec:
  maxUnavailable: 1
  unhealthyPodEvictionPolicy: AlwaysAllow
  selector:
    matchLabels:
      {{- include "snapflow.selectorLabels" (dict "root" .root "component" .component) | nindent 6 }}
{{- end }}
{{- end -}}
