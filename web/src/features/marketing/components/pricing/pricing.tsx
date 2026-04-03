/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Link } from "react-router";
import { cn } from "@/lib/utils";
import {
  BILLING_TIERS,
  type BillingTier,
  formatRate,
  HOURLY_RATES,
  presetHourlyCost,
} from "@/constants/billing";
import { Path } from "@/constants/paths";

interface TierDisplay {
  description: string;
  color: string;
  highlighted?: boolean;
}

const TIER_DISPLAY: Record<string, TierDisplay> = {
  free: {
    description: "Get started with no commitment",
    color: "#2ABBF8",
  },
  pro: {
    description: "For developers shipping to production",
    color: "#00F701",
    highlighted: true,
  },
  elite: {
    description: "For teams running high-demand workloads",
    color: "#FA4EDF",
  },
  max: {
    description: "For power users pushing the limits",
    color: "#FFCC02",
  },
  enterprise: {
    description: "For organizations needing security and scale",
    color: "#FF6B2C",
  },
};

interface Tier {
  id: string;
  name: string;
  description: string;
  walletMinimum: string;
  color: string;
  highlighted?: boolean;
  limits: { label: string; value: string }[];
}

function fmtLimit(v: number): string {
  return v === -1 ? "Unlimited" : String(v);
}

function fmtLife(s: number): string {
  if (s === -1) return "Unlimited";
  if (s < 3600) return `${s / 60} min`;
  if (s < 86400) return `${s / 3600} hour${s >= 7200 ? "s" : ""}`;
  return `${s / 86400} day${s >= 172800 ? "s" : ""}`;
}

function fmtMem(mb: number): string {
  if (mb === -1) return "Custom";
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

function fmtStorage(gb: number): string {
  if (gb === -1) return "Custom";
  return gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`;
}

function fmtWallet(amount: number): string {
  if (amount === -1) return "Custom";
  if (amount === 0) return "$0";
  return `$${amount}`;
}

function toTier(bt: BillingTier): Tier {
  const display = TIER_DISPLAY[bt.id] ?? { description: "", color: "#999" };
  return {
    id: bt.id,
    name: bt.name,
    description: display.description,
    walletMinimum: fmtWallet(bt.minWalletBalance),
    color: display.color,
    highlighted: display.highlighted,
    limits: [
      { label: "Concurrent sandboxes", value: fmtLimit(bt.maxConcurrentSandboxes) },
      { label: "Max sandbox lifetime", value: fmtLife(bt.maxSandboxLifetimeSeconds) },
      { label: "Max memory", value: fmtMem(bt.maxMemoryPerSandbox) },
      { label: "Max vCPUs", value: fmtLimit(bt.maxCpuPerSandbox) },
      { label: "Storage", value: fmtStorage(bt.maxStorageTotal) },
      { label: "Buckets", value: fmtLimit(bt.bucketQuota) },
    ],
  };
}

const TIERS: Tier[] = Object.values(BILLING_TIERS).map(toTier);

interface UsageRow {
  resource: string;
  spec?: string;
  price: string;
  unit: string;
}

const COMPUTE_RATES: UsageRow[] = [
  { resource: "vCPU", price: formatRate(HOURLY_RATES.CPU), unit: "core / hour" },
  { resource: "Memory", price: formatRate(HOURLY_RATES.MEMORY), unit: "GiB / hour" },
  { resource: "Disk", price: formatRate(HOURLY_RATES.DISK), unit: "GiB / hour" },
  { resource: "GPU", price: formatRate(HOURLY_RATES.GPU), unit: "GPU / hour" },
];

const PRESETS: { name: string; cpu: number; memoryMb: number }[] = [
  { name: "Micro", cpu: 1, memoryMb: 512 },
  { name: "Small", cpu: 1, memoryMb: 1024 },
  { name: "Medium", cpu: 2, memoryMb: 4096 },
  { name: "Large", cpu: 4, memoryMb: 8192 },
  { name: "XL", cpu: 8, memoryMb: 16384 },
  { name: "2XL", cpu: 16, memoryMb: 32768 },
];

const PRESET_RATES: UsageRow[] = PRESETS.map((p) => ({
  resource: p.name,
  spec: `${p.cpu} vCPU · ${p.memoryMb >= 1024 ? `${p.memoryMb / 1024} GB` : `${p.memoryMb} MB`}`,
  price: formatRate(presetHourlyCost(p.cpu, p.memoryMb)),
  unit: "/ hour",
}));

function TierCard({ tier }: { tier: Tier }) {
  const isEnterprise = tier.id === "enterprise";

  return (
    <div className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white">
      <div className="flex flex-col gap-1 p-5 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-[430] font-season text-[#1C1C1C] text-[20px] leading-[100%] tracking-[-0.02em]">
            {tier.name}
          </h3>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tier.color }} />
        </div>
        <p className="font-[430] font-season text-[#5c5c5c] text-[13px] leading-[140%]">
          {tier.description}
        </p>
      </div>

      <div className="border-[#E5E5E5] border-t px-5 py-4">
        <p className="font-season text-[#999] text-[11px] uppercase tracking-[0.04em]">
          Min. wallet balance
        </p>
        <p className="mt-1 font-[430] font-season text-[#1C1C1C] text-[24px] leading-[100%] tracking-[-0.02em]">
          {tier.walletMinimum}
          {tier.id !== "free" && tier.id !== "enterprise" && (
            <span className="ml-1 text-[#999] text-[13px]">/ mo</span>
          )}
        </p>
      </div>

      <div className="flex flex-1 flex-col border-[#E5E5E5] border-t">
        {tier.limits.map((limit, i) => (
          <div
            key={limit.label}
            className={cn(
              "flex items-center justify-between px-5 py-2.5",
              i < tier.limits.length - 1 && "border-[#F0F0F0] border-b"
            )}
          >
            <span className="font-season text-[#5c5c5c] text-[13px]">{limit.label}</span>
            <span className="font-[430] font-season text-[#1C1C1C] text-[13px]">{limit.value}</span>
          </div>
        ))}
      </div>

      <div className="border-[#E5E5E5] border-t p-4">
        {isEnterprise ? (
          <a
            href="mailto:sales@snapflow.io"
            className="flex h-8 w-full items-center justify-center rounded-[5px] border border-[#E5E5E5] font-[430] font-season text-[#1C1C1C] text-[14px] transition-colors hover:bg-[#F0F0F0]"
          >
            Contact us
          </a>
        ) : tier.highlighted ? (
          <Link
            to={Path.SIGNUP}
            className="flex h-8 w-full items-center justify-center rounded-[5px] border border-[#1D1D1D] bg-[#1D1D1D] font-[430] font-season text-[14px] text-white transition-colors hover:border-[#2A2A2A] hover:bg-[#2A2A2A]"
          >
            Get started
          </Link>
        ) : (
          <Link
            to={Path.SIGNUP}
            className="flex h-8 w-full items-center justify-center rounded-[5px] border border-[#E5E5E5] font-[430] font-season text-[#1C1C1C] text-[14px] transition-colors hover:bg-[#F0F0F0]"
          >
            Get started
          </Link>
        )}
      </div>

      <div className="relative h-1.5">
        <div
          className="absolute inset-0 rounded-b-sm opacity-60"
          style={{ backgroundColor: tier.color }}
        />
        <div
          className="absolute top-0 right-0 bottom-0 left-[12%] rounded-b-sm opacity-60"
          style={{ backgroundColor: tier.color }}
        />
        <div
          className="absolute top-0 right-0 bottom-0 left-[25%] rounded-b-sm"
          style={{ backgroundColor: tier.color }}
        />
      </div>
    </div>
  );
}

function RateTable({ title, rows, color }: { title: string; rows: UsageRow[]; color: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
      <div className="border-[#E5E5E5] border-b px-5 py-3">
        <h3 className="font-[430] font-season text-[#1C1C1C] text-[15px]">{title}</h3>
      </div>
      <div className="divide-y divide-[#F0F0F0]">
        {rows.map((row) => (
          <div key={row.resource} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-[430] font-season text-[#1C1C1C] text-[14px]">
                {row.resource}
              </span>
              {row.spec && <span className="font-season text-[#999] text-[12px]">{row.spec}</span>}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[#1C1C1C] text-[14px]">{row.price}</span>
              <span className="font-season text-[#999] text-[12px]">{row.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="bg-[#F6F6F6]">
      <div className="px-4 pt-20 pb-20 sm:px-8 md:px-20">
        <div className="flex flex-col items-start gap-3 sm:gap-4 md:gap-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2ABBF8]/10 px-2.5 py-0.75 font-season text-[#2ABBF8] text-[11px] uppercase tracking-[0.02em]">
            <span className="h-1.25 w-1.25 rounded-full bg-[#2ABBF8]" />
            Pricing
          </span>

          <h2
            id="pricing-heading"
            className="font-[430] font-season text-[#1C1C1C] text-[32px] leading-[100%] tracking-[-0.02em] sm:text-[36px] md:text-[40px]"
          >
            Pay for what you use
          </h2>

          <p className="max-w-140 font-[430] font-season text-[#5c5c5c] text-[15px] leading-[150%] tracking-[0.02em] lg:text-[17px]">
            Add funds to your organization wallet and only pay for the compute you consume. Higher
            wallet balances unlock higher limits automatically.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-12 lg:grid-cols-5">
          {TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} />
          ))}
        </div>

        <div className="mt-16">
          <h3 className="font-[430] font-season text-[#1C1C1C] text-[24px] leading-[100%] tracking-[-0.02em] sm:text-[28px]">
            Compute rates
          </h3>
          <p className="mt-2 font-[430] font-season text-[#5c5c5c] text-[14px] leading-[150%]">
            Billed per second. All sandbox time is deducted from your wallet balance.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RateTable title="Resources" rows={COMPUTE_RATES} color="#2ABBF8" />
            <RateTable title="Sandbox Presets" rows={PRESET_RATES} color="#00F701" />
          </div>

          <p className="mt-4 font-season text-[#999] text-[12px] leading-[150%]">
            Per-second billing with 1-minute minimum. Prices shown exclude applicable taxes.
            Persistent storage billed at rest even when sandboxes are stopped.
          </p>
        </div>
      </div>
    </section>
  );
}
