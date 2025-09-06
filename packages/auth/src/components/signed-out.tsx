import { type ReactNode, useContext } from "react";

import { AuthUIContext } from "../lib/auth-ui-provider";

export function SignedOut({ children }: { children: ReactNode }) {
  const {
    hooks: { useSession },
  } = useContext(AuthUIContext);
  const { data, isPending } = useSession();

  return !data && !isPending ? children : null;
}
