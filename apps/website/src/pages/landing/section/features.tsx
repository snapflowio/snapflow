import { StarIcon } from "lucide-react";
import Avatar from "../components/avatar";
import Container from "../components/container";
import FeatureCard from "../components/feature-card";
import Key from "../components/key";
import { SectionBadge } from "../components/section-badge";

const features = [
  "Create AI agents",
  "Custom Code",
  "Build with AI",
  "Custom Knowledge",
  "MCP Tool Access",
  "AI Browsers",
  "AI Sandbox",
];

export default function Features() {
  return (
    <div className="flex w-full flex-col items-center justify-center py-12 md:py-16 lg:py-24">
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <SectionBadge title="Features" />
          <h2 className="!leading-snug mt-4 bg-gradient-to-b from-white via-60% to-gray-400 bg-clip-text font-black font-heading text-2xl text-transparent md:text-4xl lg:text-5xl">
            Be 10x more productive
          </h2>
          <p className="mt-4 text-center text-accent-foreground/80 text-base md:text-lg">
            Automate your daily workflow, preform complex tasks with multiple AI
            agents, and more; tailored to what you need.
          </p>
        </div>
      </Container>
      <div className="mt-16 w-full">
        <div className="flex w-full flex-col items-center gap-5 lg:gap-5">
          <Container>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-3">
              <FeatureCard
                title="Team Prompting"
                description="Prompt the same AI agent with others in your team, in a conflict free way."
                className="group md:col-span-2 lg:col-span-1"
              >
                <div className="flex aspect-video items-center justify-center">
                  <Avatar className="z-40 border-[#EA55B3]">
                    <img
                      width={100}
                      height={100}
                      src={"/avatars/avatar1.jpg"}
                      alt="Avatar 1"
                      className="rounded-full"
                    />
                  </Avatar>
                  <Avatar className="-ml-6 z-30 border-primary">
                    <img
                      width={100}
                      height={100}
                      src={"/avatars/avatar2.jpg"}
                      alt="Avatar 2"
                      className="rounded-full "
                    />
                  </Avatar>
                  <Avatar className="-ml-6 z-20 border-[#B41DF8]">
                    <img
                      width={100}
                      height={100}
                      src={"/avatars/avatar3.jpg"}
                      alt="Avatar 3"
                      className="rounded-full"
                    />
                  </Avatar>
                </div>
              </FeatureCard>
              <FeatureCard
                title="Natural Language"
                description="No drag and drop, create workflows, automations, and more with just natural language."
                className="group md:col-span-2 lg:col-span-1"
              >
                <div className="flex aspect-video items-center justify-center">
                  <p className="text-center font-extrabold text-4xl text-white/20 transition duration-500 group-hover:text-white/10">
                    Open a{" "}
                    <span className="relative text-primary">
                      <span>browser</span>
                    </span>{" "}
                    and go to...
                  </p>
                </div>
              </FeatureCard>
              <FeatureCard
                title="Quick Access"
                description="Navigate through our entire UI entirely using keyboard shortcuts, time is money."
                className="group md:col-span-2 md:col-start-2 lg:col-span-1 lg:col-start-auto"
              >
                <div className="flex aspect-video items-center justify-center gap-4">
                  <Key className="w-28 outline-2 outline-tranparent outline-offset-4 transition-all duration-500 group-hover:translate-y-1 group-hover:outline-primary">
                    shift
                  </Key>
                  <Key className=" outline-2 outline-transparent outline-offset-4 transition-all delay-150 duration-500 group-hover:translate-y-1 group-hover:outline-primary">
                    alt
                  </Key>
                  <Key className="outline-2 outline-transparent outline-offset-4 transition-all delay-300 duration-500 group-hover:translate-y-1 group-hover:outline-primary">
                    C
                  </Key>
                </div>
              </FeatureCard>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="group inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 px-3 py-1.5 transition duration-500 hover:scale-105 md:px-5 md:py-2"
                >
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-neutral-950 text-xl transition duration-500 group-hover:rotate-45">
                    <StarIcon fill="#000" className="size-4" />
                  </span>
                  <span className="font-medium md:text-lg">{feature}</span>
                </div>
              ))}
            </div>
          </Container>
        </div>
      </div>
    </div>
  );
}
