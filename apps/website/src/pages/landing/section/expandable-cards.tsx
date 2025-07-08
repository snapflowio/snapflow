"use client";

import { type JSX, useState } from "react";
import { motion } from "framer-motion";
import { BotIcon, NotebookIcon, Plus, WorkflowIcon } from "lucide-react";
import { BrainIcon, OpenAIIcon } from "@/components/icons";
import { cn } from "@/lib/util";

type Card = {
  id: number;
  title: string;
  description: string | JSX.Element;
  icon: React.ComponentType<{ className?: string; color?: string }>;
};

const CARDS: Card[] = [
  {
    id: 1,
    title: "Prompt with ChatGPT",
    description:
      "Our platform allows you to use ChatGPT in your flows, opening the door to for you to make custom agents, make logic decisions, write custom code, and more.",
    icon: OpenAIIcon,
  },
  {
    id: 2,
    title: "Use AI browsers",
    description:
      "Need to scrape content or preform an action with a web browser? With our AI powered browsers, all you need to do is prompt to have your actions carried out.",
    icon: BrainIcon,
  },
  {
    id: 3,
    title: "Complex Logic",
    description:
      "Need complex conditions or logic in your backend? We make it easier with AI powerered decision nodes that route your flow based on your data, with minimal input from you.",
    icon: WorkflowIcon,
  },

  {
    id: 4,
    title: "Knowledge Notebooks",
    description:
      "Upload files or text to act as knowledge in your backend flow or AI agents.",
    icon: NotebookIcon,
  },
  {
    id: 5,
    title: "Custom AI Agents",
    description:
      "Build and publish your own custom AI agents, or even embed them into your flows and backend logic.",
    icon: BotIcon,
  },
];

const ANIMATION_DURATION = 0.3;
const ANIMATION_DELAY = 0.2;

export function ExpandableCards() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleCardClick = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getCardWidth = (cardId: number) =>
    expandedId === null
      ? "w-[185px]"
      : expandedId === cardId
        ? "w-[380px]"
        : "w-[185px]";

  return (
    <>
      <div className="hidden items-center justify-center px-6 pt-40 pb-6 lg:flex">
        <div className="w-full max-w-[1049px] rounded-xl p-5">
          <div className="flex flex-col items-center justify-center gap-10 pb-5">
            <h1 className="w-3/4 text-center font-bold text-6xl leading-tight">
              Power-up your backend with our{" "}
              <span className="text-[#FF69F9]">AI integrations</span>
            </h1>
            <p className="w-1/2 text-center text-2xl">
              Use LLMs, generate images and video, create custom AI agents, use
              AI browsers, and more.
            </p>
          </div>
          <div className="mt-10 flex gap-5">
            {CARDS.map((card) => (
              <motion.div
                key={card.id}
                className={cn(
                  "relative h-44 cursor-pointer overflow-hidden rounded-xl border bg-background",
                  getCardWidth(card.id),
                )}
                layout
                onClick={() => handleCardClick(card.id)}
                transition={{ duration: ANIMATION_DURATION }}
              >
                <div className="relative flex h-full flex-col justify-between p-4">
                  <motion.div
                    layout
                    className="absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full opacity-50"
                    transition={{ duration: ANIMATION_DURATION }}
                  >
                    <Plus
                      className={cn(
                        "h-4 w-4 stroke-[3.4] transition-transform duration-300",
                        expandedId === card.id && "rotate-45",
                      )}
                    />
                  </motion.div>

                  {expandedId !== card.id ? (
                    <>
                      <motion.div
                        layout="position"
                        className="flex h-full flex-col justify-between"
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card">
                          <card.icon className="h-10 w-10" />
                        </div>
                        <h1 className="whitespace-pre-line font-[550] text-xl leading-6">
                          {card.title}
                        </h1>
                      </motion.div>
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: ANIMATION_DELAY }}
                      className="flex h-full flex-col"
                    >
                      <div className="mb-3 font-[550] text-xl leading-6">
                        {card.title}
                      </div>
                      <p className="whitespace-pre-line text-foreground text-sm">
                        {card.description}
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <div className="block w-full px-6 pt-2 pb-6 lg:hidden">
        <div className="mx-auto w-full max-w-3xl rounded-xl border-2 border-gray-200 px-5 py-5 dark:border-gray-50">
          <h2 className="mb-5 font-semibold text-2xl md:text-[28px] dark:text-gray-900">
            The AI space changes fast— PearAI Inventory curates the best AI
            tools on the market, and integrates them into a powerful editor.
          </h2>
          <div className="space-y-4">
            {CARDS.map((card) => (
              <div
                key={card.id}
                className="overflow-hidden rounded-xl border border-gray-200 transition-all duration-200 dark:border-gray-700 dark:bg-opacity-90"
                onClick={() => handleCardClick(card.id)}
              >
                <div className="px-4 py-4">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl">
                        <card.icon className="h-8 w-8" />
                      </div>
                      <div className="font-semibold text-base sm:text-lg">
                        {card.title}
                      </div>
                    </div>
                    <div className="flex h-5 w-5 items-center justify-center rounded-full opacity-40">
                      <Plus
                        className={cn(
                          "h-4 w-4 stroke-[3.4] transition-transform duration-300",
                          expandedId === card.id && "rotate-45",
                        )}
                      />
                    </div>
                  </div>
                  <div
                    className={cn(
                      "max-h-0 overflow-hidden whitespace-pre-line transition-all duration-300",
                      expandedId === card.id && "max-h-[200px] pt-4",
                    )}
                  >
                    <p className="ml-16 text-foreground text-sm sm:text-base">
                      {card.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
