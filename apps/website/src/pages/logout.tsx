import { useEffect } from "react";
import { useLogto } from "@logto/react";
import { Loading } from "@/components/loading";

export default function Logout() {
  const { signOut } = useLogto();

  useEffect(() => {
    void signOut();
  }, [signOut]);

  return <Loading />;
}
