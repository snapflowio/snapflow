{{- define "snapflow.labels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/part-of: snapflow
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version }}
{{- end -}}

{{- define "snapflow.selectorLabels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}

{{- define "snapflow.image" -}}
{{- $image := index .root.Values.images .key -}}
{{- $repository := printf "ghcr.io/%s/%s" (required "imageNamespace is required" .root.Values.imageNamespace) .name -}}
{{- $tag := required (printf "images.%s.tag is required" .key) $image.tag -}}
{{- if $image.digest -}}
{{ printf "%s:%s@%s" $repository $tag $image.digest }}
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
