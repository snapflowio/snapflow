variable "state_passphrase" {
  type        = string
  sensitive   = true
  description = "Encrypts this configuration's state in R2; at least 16 characters, kept in the recovery kit"
}

variable "cluster_settings_file" {
  type        = string
  default     = "../../clusters/production/cluster-settings.env"
  description = "Flux's cluster settings, the single source of the backup bucket and the public domain"
}
