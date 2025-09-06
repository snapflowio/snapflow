import { createFileRoute } from "@tanstack/react-router";
import { WelcomeMessage } from "./-components/welcome";

export const Route = createFileRoute("/home/")({
  component: Home,
});

function Home() {
  return (
    <div className="flex flex-1 gap-6">
      <div className="flex-1">
        <WelcomeMessage />
      </div>
      <div className="min-w-[380px] rounded-lg border p-4">Right side</div>
    </div>
  );
}
