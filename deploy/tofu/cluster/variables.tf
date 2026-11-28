variable "state_passphrase" {
  type        = string
  sensitive   = true
  description = "Encrypts this configuration's state in R2; at least 16 characters, kept in the recovery kit"
}

variable "github_app_private_key_file" {
  type        = string
  description = "The snapflowio-automation GitHub App private key (.pem) Flux pulls the repository with"
}

variable "create_openbao_seal" {
  type        = bool
  default     = false
  description = "Generate and keep the OpenBao static seal key; set it on a new cluster and leave it set, never on a cluster whose seal key already exists"
}

variable "kubeconfig_path" {
  type        = string
  default     = "~/.kube/config"
  description = "Kubeconfig of the cluster to bootstrap"
}

variable "kubeconfig_context" {
  type        = string
  default     = null
  description = "Kubeconfig context of the cluster to bootstrap; the current context when unset"
}

variable "cluster_settings_file" {
  type        = string
  default     = "../../clusters/production/cluster-settings.env"
  description = "Flux's cluster settings, the single source of the backup bucket and endpoint"
}
