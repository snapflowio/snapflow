import { Plus } from "lucide-react";
import Link from "next/link";
import { OpenAI } from "@/components/svgs/chatgpt";
import { Claude } from "@/components/svgs/claude";
import { Gemini } from "@/components/svgs/gemini";
import { Button } from "@/components/ui/button";

export default function IntegrationsSection() {
  return (
    <section>
      <div className="bg-muted dark:bg-background">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-md px-6 [mask-image:radial-gradient(ellipse_100%_100%_at_50%_0%,#000_70%,transparent_100%)]">
            <div className="rounded-xl border bg-background px-6 pt-3 pb-12 shadow-xl dark:bg-muted/50">
              <Integration
                icon={<Gemini />}
                name="Gemini"
                description="The AI model that powers Google's search engine."
              />
              <Integration
                icon={<Claude />}
                name="Claude"
                description="Anthropics powerful AI model, best suited for coding."
              />
              <Integration
                icon={<OpenAI />}
                name="ChatGPT"
                description="OpenAI's versatile AI model, designed for natural conversations and problem-solving."
              />
            </div>
          </div>
          <div className="mx-auto mt-6 max-w-lg space-y-6 text-center">
            <h2 className="text-balance font-semibold text-3xl md:text-4xl lg:text-5xl">
              Use with your favorite LLMs
            </h2>
            <p className="text-muted-foreground">
              Control your sandboxes and environments with AI. Make automations, environment, and
              more all AI.
            </p>

            <Button variant="outline" asChild>
              <Link href="#">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Integration({
  icon,
  name,
  description,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-dashed py-3 last:border-b-0">
      <div className="flex size-12 items-center justify-center rounded-lg border border-foreground/5 bg-muted">
        {icon}
      </div>
      <div className="space-y-0.5">
        <h3 className="font-medium text-sm">{name}</h3>
        <p className="line-clamp-1 text-muted-foreground text-sm">{description}</p>
      </div>
      <Button variant="outline" size="icon" aria-label="Add integration">
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
