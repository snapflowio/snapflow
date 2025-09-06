import { Button, SparklesText } from "@snapflow/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

export const Route = createFileRoute("/(marketing)/")({
  component: Index,
});

function Index() {
  return (
    <main className="flex flex-col items-center justify-center py-12 md:py-16 lg:py-24">
      <div className="flex flex-col items-center gap-6">
        <h1 className="max-w-[20ch] text-balance bg-gradient-to-b from-foreground to-gray-foreground-muted bg-clip-text pb-2 text-center font-extrabold text-5xl text-transparent leading-none md:text-6xl lg:text-8xl">
          Student Productivity{" "}
          <SparklesText
            className="font-extrabold text-5xl md:text-6xl lg:text-8xl"
            sparklesCount={5}
            colors={{ first: "#4fd9fa", second: "#3d76e3" }}
          >
            Reimagined
          </SparklesText>
        </h1>
        <p className="max-w-[50ch] text-pretty text-center text-foreground-muted lg:text-lg [&>strong]:font-medium [&>strong]:text-foreground">
          Gamified social and productivity platform for students. Build good academic habits while
          having fun in the process.
        </p>
        <Button className="rounded-full" size="lg" asChild>
          <Link to="/">
            Get Started <ChevronRightIcon size={20} strokeWidth={2.5} />
          </Link>
        </Button>
      </div>
    </main>
  );
}
