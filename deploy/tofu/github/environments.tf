data "github_user" "release_reviewer" {
  username = local.release_reviewer
}

resource "github_repository_environment" "release" {
  for_each = local.environments

  repository          = github_repository.snapflow.name
  environment         = each.key
  can_admins_bypass   = true
  prevent_self_review = false

  dynamic "reviewers" {
    for_each = each.value.reviewed ? [data.github_user.release_reviewer.id] : []
    content {
      users = [reviewers.value]
    }
  }

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_repository_environment_deployment_policy" "release" {
  for_each = github_repository_environment.release

  repository     = github_repository.snapflow.name
  environment    = each.value.environment
  branch_pattern = local.default_branch
}
