locals {
  settings = {
    for pair in regexall("(?m)^([A-Z0-9_]+)=(.*)$", file(var.cluster_settings_file)) : pair[0] => pair[1]
  }

  owner          = "snapflowio"
  repository     = "snapflow"
  default_branch = "main"
  release_tags   = "refs/tags/v*"

  admin_repository_role_id = 5
  automation_app_id        = 5586776
  github_actions_app_id    = 15368
  required_check           = "CI passed"
  release_reviewer         = "BryanLawless"

  environments = {
    automation = { reviewed = false }
    beta       = { reviewed = false }
    stable     = { reviewed = true }
  }

  actions_variables = {
    POSTHOG_HOST                  = "https://us.i.posthog.com"
    POSTHOG_PROJECT_KEY           = "phc_zxix3uAdohTEgncke4FZUY78T6mXTQ5nXaDZ4dLvmonb"
    SNAPFLOW_AUTOMATION_CLIENT_ID = "Iv23liRbCsBn7kD6p6RO"
  }
}
