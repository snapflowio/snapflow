"use client";

import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Loading } from "@/components/loading";

export default function LogoutPage() {
  const { logout } = useAuth0();

  useEffect(() => {
    void logout();
  }, [logout]);

  return <Loading />;
}
