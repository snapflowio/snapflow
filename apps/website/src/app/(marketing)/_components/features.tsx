"use client";

import { BotIcon, BoxIcon, BrainIcon, PencilIcon, RocketIcon, TerminalIcon } from "lucide-react";

export function Features() {
  return (
    <section>
      <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
        <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
          <h2 className="!leading-snug mt-4 font-bold font-heading text-2xl md:text-4xl lg:text-5xl">
            Built to do anything
          </h2>
          <p className="mt-4 text-center text-accent-foreground/80 text-base md:text-lg">
            Secure, isolated sandbox environments for AI agents, automations, code execution, and
            more.
          </p>
        </div>

        <div className="relative mx-auto grid max-w-4xl divide-x divide-y border *:p-12 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BotIcon className="size-4" />
              <h3 className="font-medium text-sm">AI Agents</h3>
            </div>
            <p className="text-sm">Give your AI agents and LLM's access to an entire computer.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RocketIcon className="size-4" />
              <h3 className="font-medium text-sm">Vibe Coding</h3>
            </div>
            <p className="text-sm">Run vibe coded apps in a safe, isolated environment.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-4" />
              <h3 className="font-medium text-sm">Remote Access</h3>
            </div>
            <p className="text-sm">Access all of your sandboxes using SSH and VNC.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <PencilIcon className="size-4" />
              <h3 className="font-medium text-sm">Automations</h3>
            </div>
            <p className="text-sm">Preform automated tasks with your sandboxes.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BoxIcon className="size-4" />
              <h3 className="font-medium text-sm">Computer Use</h3>
            </div>
            <p className="text-sm">Use the internet, file system, commands, and more.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BrainIcon className="size-4" />
              <h3 className="font-medium text-sm">Build with AI</h3>
            </div>
            <p className="text-sm">Create sandboxes and automations with any LLM.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
