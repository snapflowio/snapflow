export enum Path {
  LANDING = "/",
  LOGOUT = "/logout",
  DASHBOARD = "/dashboard",
}

export const getRouteSubPath = (path: Path): string => {
  return path.replace("/dashboard/", "");
};
