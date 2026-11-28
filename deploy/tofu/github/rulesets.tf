resource "github_repository_ruleset" "main" {
  repository  = github_repository.snapflow.name
  name        = local.default_branch
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/heads/${local.default_branch}"]
      exclude = []
    }
  }

  bypass_actors {
    actor_type  = "RepositoryRole"
    actor_id    = local.admin_repository_role_id
    bypass_mode = "pull_request"
  }

  bypass_actors {
    actor_type  = "Integration"
    actor_id    = local.automation_app_id
    bypass_mode = "always"
  }

  rules {
    deletion         = true
    non_fast_forward = true

    pull_request {
      allowed_merge_methods             = ["squash"]
      dismiss_stale_reviews_on_push     = false
      require_code_owner_review         = false
      require_last_push_approval        = false
      required_approving_review_count   = 0
      required_review_thread_resolution = false
    }

    required_status_checks {
      strict_required_status_checks_policy = false
      do_not_enforce_on_create             = false

      required_check {
        context        = local.required_check
        integration_id = local.github_actions_app_id
      }
    }
  }
}

resource "github_repository_ruleset" "release_tags" {
  repository  = github_repository.snapflow.name
  name        = "release tags"
  target      = "tag"
  enforcement = "active"

  conditions {
    ref_name {
      include = [local.release_tags]
      exclude = []
    }
  }

  bypass_actors {
    actor_type  = "Integration"
    actor_id    = local.automation_app_id
    bypass_mode = "always"
  }

  rules {
    creation = true
    update   = true
    deletion = true
  }
}
