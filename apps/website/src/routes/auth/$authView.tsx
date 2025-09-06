import { AuthView } from "@snapflow/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/$authView")({
  component: RouteComponent,
});

function RouteComponent() {
  const { authView } = Route.useParams();

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-3 self-center p-4 md:p-6">
      <div className="w-full max-w-sm">
        <AuthView pathname={authView} />
      </div>
    </main>
  );
}
