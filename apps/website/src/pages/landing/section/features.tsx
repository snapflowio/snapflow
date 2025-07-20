import { StarIcon } from "lucide-react";
import Avatar from "../components/avatar";
import Container from "../components/container";
import FeatureCard from "../components/feature-card";
import Key from "../components/key";
import { SectionBadge } from "../components/section-badge";

const features = [
  "Run code safely",
  "AI Builder",
  "1 second startup time",
  "MCP Server",
  "Deploy Docker images",
  "Remote access",
  "Automated sandboxes",
];

export default function Features() {
  return (
    <div className="flex w-full flex-col items-center justify-center">
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <SectionBadge title="Features" />
          <h2 className="!leading-snug mt-4 font-bold font-heading text-2xl md:text-4xl lg:text-5xl">
            Your powerful sanboxes
          </h2>
          <p className="mt-4 text-center text-accent-foreground/80 text-base md:text-lg">
            Create one or multiple sandboxes to run Docker images, run user generated code, automate
            tasks, and more.
          </p>
        </div>
      </Container>
      <div className="mt-16 w-full">
        <div className="flex w-full flex-col items-center gap-5 lg:gap-5">
          <Container>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-3">
              <FeatureCard
                title="Workspaces"
                description="Share sandboxes, resources, and collaborate with members in your organization."
                className="group md:col-span-2 lg:col-span-1"
              >
                <div className="flex aspect-video items-center justify-center">
                  <Avatar className="z-40 border-blue-400">
                    <img
                      width={100}
                      height={100}
                      src={"/avatars/avatar1.jpg"}
                      alt="Avatar 1"
                      className="rounded-full"
                    />
                  </Avatar>
                  <Avatar className="-ml-6 z-30 border-green-400">
                    <img
                      width={100}
                      height={100}
                      src={"/avatars/avatar2.jpg"}
                      alt="Avatar 2"
                      className="rounded-full "
                    />
                  </Avatar>
                  <Avatar className="-ml-6 z-20 border-purple-400">
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
                title="Build with AI"
                description="Create sandboxes to preform specific tasks using natural language; whether its web scraping, data analysis, or automated tasks."
                className="group md:col-span-2 lg:col-span-1"
              >
                <div className="flex aspect-video items-center justify-center">
                  <p className="text-left font-extrabold text-4xl text-white/20 transition duration-500 group-hover:text-white/10">
                    Create a{" "}
                    <span className="relative text-green-400">
                      <span>sandbox</span>
                    </span>{" "}
                    that...
                  </p>
                </div>
              </FeatureCard>
              <FeatureCard
                title="Remote Access"
                description="Access all of your sandboxes securely using SSH and remote desktop, wherever you are."
                className="group md:col-span-2 md:col-start-2 lg:col-span-1 lg:col-start-auto"
              >
                <div className="flex aspect-video items-center justify-center gap-4">
                  <Key className="w-28 outline-2 outline-tranparent outline-offset-4 transition-all duration-500 group-hover:translate-y-1 group-hover:outline-green-400">
                    shift
                  </Key>
                  <Key className=" outline-2 outline-transparent outline-offset-4 transition-all delay-150 duration-500 group-hover:translate-y-1 group-hover:outline-green-400">
                    alt
                  </Key>
                  <Key className="outline-2 outline-transparent outline-offset-4 transition-all delay-300 duration-500 group-hover:translate-y-1 group-hover:outline-green-400">
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
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-green-400 text-neutral-950 text-xl transition duration-500 group-hover:rotate-45">
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
