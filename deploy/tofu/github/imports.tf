import {
  to = github_repository.snapflow
  id = local.repository
}

import {
  to = github_branch_default.snapflow
  id = local.repository
}

import {
  to = github_repository_vulnerability_alerts.snapflow
  id = local.repository
}

import {
  to = github_repository_dependabot_security_updates.snapflow
  id = local.repository
}

import {
  to = github_actions_repository_permissions.snapflow
  id = local.repository
}

import {
  to = github_workflow_repository_permissions.snapflow
  id = local.repository
}

import {
  for_each = local.actions_variables
  to       = github_actions_variable.snapflow[each.key]
  id       = "${local.repository}:${each.key}"
}

import {
  to = github_repository_ruleset.main
  id = "${local.repository}:26419401"
}

import {
  to = github_repository_ruleset.release_tags
  id = "${local.repository}:26421222"
}

import {
  for_each = local.environments
  to       = github_repository_environment.release[each.key]
  id       = "${local.repository}:${each.key}"
}

import {
  for_each = {
    automation = 65301800
    beta       = 65301803
    stable     = 65301804
  }
  to = github_repository_environment_deployment_policy.release[each.key]
  id = "${local.repository}:${each.key}:${each.value}"
}
