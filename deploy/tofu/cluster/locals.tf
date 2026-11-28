locals {
  settings = {
    for pair in regexall("(?m)^([A-Z0-9_]+)=(.*)$", file(var.cluster_settings_file)) : pair[0] => pair[1]
  }
}
