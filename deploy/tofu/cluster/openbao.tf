locals {
  openbao_namespace     = "openbao"
  openbao_seal_secret   = "openbao-seal"
  openbao_seal_key_size = 32
  openbao_seal_count    = var.create_openbao_seal ? 1 : 0
}

ephemeral "random_bytes" "openbao_seal" {
  count  = local.openbao_seal_count
  length = local.openbao_seal_key_size
}

resource "kubernetes_namespace_v1" "openbao" {
  count = local.openbao_seal_count

  metadata {
    name = local.openbao_namespace
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

resource "kubernetes_secret_v1" "openbao_seal" {
  count = local.openbao_seal_count

  metadata {
    name      = local.openbao_seal_secret
    namespace = kubernetes_namespace_v1.openbao[0].metadata[0].name
  }

  binary_data_wo          = { key = ephemeral.random_bytes.openbao_seal[0].base64 }
  binary_data_wo_revision = 1

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}
