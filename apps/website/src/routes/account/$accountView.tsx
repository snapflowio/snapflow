import { AccountView } from "@snapflow/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account/$accountView")({
  component: RouteComponent,
});

function RouteComponent() {
  const { accountView } = Route.useParams();

  return (
    <main className="container p-4 md:p-6">
      <AccountView pathname={accountView} />
    </main>
  );
}
