export enum Path {
  LANDING = "/",
  LOGOUT = "/logout",
  DASHBOARD = "/dashboard",

  API_KEYS = "/dashboard/keys",
  SANDBOXES = "/dashboard/sandboxes",
  SNAPSHOTS = "/dashboard/snapshots",
  REGISTRIES = "/dashboard/registries",
  VOLUMES = "/dashboard/volumes",
  USAGE = "/dashboard/usage",
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
