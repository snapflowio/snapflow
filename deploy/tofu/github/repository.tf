resource "github_repository" "snapflow" {
  name         = local.repository
  description  = "Deploy apps on machines run by many. An open-source compute marketplace built to be a fast, scalable, and a feature rich alternative to big-cloud."
  homepage_url = "https://${local.settings.PUBLIC_DOMAIN}"
  visibility   = "public"
  topics = [
    "cloud",
    "cloud-computing",
    "compute-marketplace",
    "firecracker",
    "golang",
    "gpu-cloud",
    "microvm",
    "paas",
    "sandbox",
    "self-hosted",
    "typescript",
  ]

  has_issues      = true
  has_projects    = true
  has_wiki        = true
  has_discussions = false

  allow_merge_commit          = false
  allow_rebase_merge          = false
  allow_squash_merge          = true
  squash_merge_commit_title   = "PR_TITLE"
  squash_merge_commit_message = "PR_BODY"
  merge_commit_title          = "PR_TITLE"
  merge_commit_message        = "PR_BODY"
  allow_auto_merge            = true
  allow_update_branch         = true
  delete_branch_on_merge      = true
  web_commit_signoff_required = false

  archive_on_destroy = true

  security_and_analysis {
    secret_scanning {
      status = "enabled"
    }
    secret_scanning_push_protection {
      status = "enabled"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "github_branch_default" "snapflow" {
  repository = github_repository.snapflow.name
  branch     = local.default_branch
}

resource "github_repository_vulnerability_alerts" "snapflow" {
  repository = github_repository.snapflow.name
  enabled    = true
}

resource "github_repository_dependabot_security_updates" "snapflow" {
  repository = github_repository.snapflow.name
  enabled    = false
}

resource "github_actions_repository_permissions" "snapflow" {
  repository           = github_repository.snapflow.name
  enabled              = true
  allowed_actions      = "all"
  sha_pinning_required = true
}

resource "github_workflow_repository_permissions" "snapflow" {
  repository                       = github_repository.snapflow.name
  default_workflow_permissions     = "read"
  can_approve_pull_request_reviews = false
}

resource "github_actions_variable" "snapflow" {
  for_each = local.actions_variables

  repository    = github_repository.snapflow.name
  variable_name = each.key
  value         = each.value
}
