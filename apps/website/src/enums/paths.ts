export enum Path {
  LANDING = "/",
  LOGOUT = "/logout",
  DASHBOARD = "/dashboard",

  API_KEYS = "/dashboard/keys",
  SANDBOXES = "/dashboard/sandboxes",
  IMAGES = "/dashboard/images",
  REGISTRIES = "/dashboard/registries",
  BUCKETS = "/dashboard/buckets",
  BILLING = "/dashboard/billing",
  MEMBERS = "/dashboard/members",
  ROLES = "/dashboard/roles",
  SETTINGS = "/dashboard/settings",
  ONBOARDING = "/dashboard/onboarding",

  USER_INVITATIONS = "/dashboard/user/invitations",
}

export const getRouteSubPath = (path: Path): string => {
  return path.replace("/dashboard/", "");
};
