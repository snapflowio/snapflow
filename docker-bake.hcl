variable "IMAGE_NAMESPACE" {
  default = "snapflowio/snapflow"
}

variable "IMAGE_TAG" {
  default = "development"
}

variable "SNAPFLOW_SOURCE_REVISION" {
  default = "unknown"
}

variable "SOURCE_URL" {
  default = "https://github.com/snapflowio/snapflow"
}

variable "PUBLIC_SITE_URL" {
  default = "https://snapflow.io"
}

group "applications" {
  targets = ["marketing", "dashboard", "api", "snapshot-manager", "edge"]
}

target "_common" {
  context = "."
  platforms = ["linux/amd64"]
  labels = {
    "org.opencontainers.image.source"   = SOURCE_URL
    "org.opencontainers.image.revision" = SNAPFLOW_SOURCE_REVISION
  }
  args = {
    SNAPFLOW_RELEASE_VERSION = IMAGE_TAG
    SNAPFLOW_SOURCE_REVISION = SNAPFLOW_SOURCE_REVISION
  }
}

# The Caddy binary the dashboard and marketing images serve with. It is not
# published on its own; those targets consume it as the "caddy" build context.
target "caddy" {
  context    = "."
  platforms  = ["linux/amd64"]
  dockerfile = "images/caddy/Dockerfile"
}

target "marketing" {
  inherits   = ["_common"]
  cache-from = ["type=registry,ref=ghcr.io/${IMAGE_NAMESPACE}/marketing:buildcache"]
  contexts   = { caddy = "target:caddy" }
  dockerfile = "apps/marketing/Dockerfile"
  tags       = ["ghcr.io/${IMAGE_NAMESPACE}/marketing:${IMAGE_TAG}"]
  labels = {
    "service" = "snapflow-marketing"
  }
  args = {
    PUBLIC_SITE_URL = PUBLIC_SITE_URL
  }
}

target "dashboard" {
  inherits   = ["_common"]
  cache-from = ["type=registry,ref=ghcr.io/${IMAGE_NAMESPACE}/dashboard:buildcache"]
  contexts   = { caddy = "target:caddy" }
  dockerfile = "apps/dashboard/Dockerfile"
  tags       = ["ghcr.io/${IMAGE_NAMESPACE}/dashboard:${IMAGE_TAG}"]
  labels = {
    "service" = "snapflow-dashboard"
  }
}

target "api" {
  inherits   = ["_common"]
  cache-from = ["type=registry,ref=ghcr.io/${IMAGE_NAMESPACE}/api:buildcache"]
  dockerfile = "apps/api/Dockerfile"
  tags       = ["ghcr.io/${IMAGE_NAMESPACE}/api:${IMAGE_TAG}"]
  labels = {
    "service" = "snapflow-api"
  }
}

target "snapshot-manager" {
  inherits   = ["_common"]
  cache-from = ["type=registry,ref=ghcr.io/${IMAGE_NAMESPACE}/snapshot-manager:buildcache"]
  dockerfile = "apps/snapshot-manager/Dockerfile"
  tags       = ["ghcr.io/${IMAGE_NAMESPACE}/snapshot-manager:${IMAGE_TAG}"]
  labels = {
    "service" = "snapflow-snapshot-manager"
  }
}

target "edge" {
  inherits   = ["_common"]
  cache-from = ["type=registry,ref=ghcr.io/${IMAGE_NAMESPACE}/edge:buildcache"]
  dockerfile = "apps/edge/Dockerfile"
  tags       = ["ghcr.io/${IMAGE_NAMESPACE}/edge:${IMAGE_TAG}"]
  labels = {
    "service" = "snapflow-edge"
  }
}
