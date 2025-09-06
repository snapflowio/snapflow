import type { ReactNode } from "react";

import { useAuthenticate } from "../hooks/use-authenticate";

export function RedirectToSignIn(): ReactNode {
  useAuthenticate({ authView: "SIGN_IN" });
  return null;
}
