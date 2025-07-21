import { useHandleSignInCallback } from "@logto/react";
import { useNavigate } from "react-router";
import { Loading } from "@/components/loading";
import { Path } from "@/enums/paths";

export function Callback() {
  const navigate = useNavigate();

  const { isLoading } = useHandleSignInCallback(() => {
    navigate(Path.DASHBOARD);
  });

  if (isLoading) return <Loading />;

  return null;
}
