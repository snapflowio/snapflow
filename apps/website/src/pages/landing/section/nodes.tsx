"use client";

import { FigmaIcon } from "lucide-react";
import {
  GithubIcon,
  GoogleDriveIcon,
  NotionIcon,
  OpenAIIcon,
  SlackIcon,
} from "@/components/icons";
import NodeColumn from "../components/node-column";

const intergrations = [
  {
    name: "Figma",
    icon: FigmaIcon,
    description: "Figma is a collaborative interface design tool.",
  },
  {
    name: "Notion",
    icon: NotionIcon,
    description: "Notion is an all-in-one workspace for notes and docs.",
  },
  {
    name: "Slack",
    icon: SlackIcon,
    description: "Slack is a powerful team communication platform.",
  },
  {
    name: "Relume",
    icon: OpenAIIcon,
    description: "Relume is a no-code website builder and design system.",
  },
  {
    name: "Framer",
    icon: GoogleDriveIcon,
    description: "Framer is a professional website prototyping tool.",
  },
  {
    name: "GitHub",
    icon: GithubIcon,
    description: "GitHub is the leading platform for code collaboration.",
  },
];

export type IntergrationType = typeof intergrations;

export default function Intergrations() {
  return (
    <>
      <div className="items-center justify-center py-24 lg:flex">
        <div className="mx-auto w-full max-w-3xl rounded-xl p-5 lg:max-w-[1049px]">
          <div className="grid items-center lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="mt-6 font-bold text-6xl">
                Integrate with{" "}
                <span className="text-[#A718F6]">your tools</span>
              </h2>
              <p className=" mt-4 text-lg text-white/50">
                Use your favorite tools, in your AI agents and flows, making it
                easier to get up and running faster and making collaboration
                with your team easier.
              </p>
            </div>
            <div>
              <div className="mt-8 grid h-[400px] gap-4 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] md:grid-cols-2 lg:mt-0 lg:h-[800px]">
                <NodeColumn integrations={intergrations} />
                <NodeColumn
                  integrations={intergrations.slice().reverse()}
                  reverse
                  className="hidden md:flex"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
