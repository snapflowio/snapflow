import { type ReactNode, useContext } from "react";

import { AuthUIContext } from "../lib/auth-ui-provider";

export function SignedIn({ children }: { children: ReactNode }) {
  const {
    hooks: { useSession },
  } = useContext(AuthUIContext);
  const { data } = useSession();

  return data ? children : null;
}
