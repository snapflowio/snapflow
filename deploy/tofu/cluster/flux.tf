locals {
  flux_system_directory = "${path.module}/../../clusters/production/flux-system"
  flux_instance_yaml    = file("${local.flux_system_directory}/flux-instance.yaml")
  flux_instance         = yamldecode(local.flux_instance_yaml)
  flux_operator_source  = yamldecode(split("\n---\n", file("${local.flux_system_directory}/flux-operator.yaml"))[0])

  github_app_id              = "5586776"
  github_app_installation_id = "186713339"
}

module "flux_operator_bootstrap" {
  source  = "controlplaneio-fluxcd/flux-operator-bootstrap/kubernetes"
  version = "0.10.0"

  revision = 1

  gitops_resources = {
    instance_yaml = local.flux_instance_yaml
    operator_chart = {
      version = local.flux_operator_source.spec.ref.tag
    }
  }

  managed_resources = {
    secrets_yaml = yamlencode({
      apiVersion = "v1"
      kind       = "Secret"
      type       = "Opaque"
      metadata = {
        name      = local.flux_instance.spec.sync.pullSecret
        namespace = local.flux_instance.metadata.namespace
      }
      stringData = {
        githubAppID             = local.github_app_id
        githubAppInstallationID = local.github_app_installation_id
        githubAppPrivateKey     = sensitive(file(var.github_app_private_key_file))
      }
    })
  }
}
