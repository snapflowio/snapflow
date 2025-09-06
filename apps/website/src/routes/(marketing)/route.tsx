import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Footer } from "./-components/footer";
import { Navbar } from "./-components/navbar";

export const Route = createFileRoute("/(marketing)")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="absolute top-0 left-0 z-[-1] h-56 w-full bg-gradient-to-b from-indigo-subtle to-background" />
      <Navbar />
      <div className="container flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
