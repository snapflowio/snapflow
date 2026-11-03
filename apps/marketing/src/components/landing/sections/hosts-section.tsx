/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { HostMachine } from '@/components/landing/visuals/host-machine';
import { AnimatedSection, Badge } from '@/components/ui/marketing-primitives';
import { CONTENT_WIDTH, DISPLAY_FONT, MONO_FONT } from '@/lib/marketing-styles';

const SETUP_COMMAND = 'curl -fsSL https://snapflow.io/install.sh | sh';
const PERCENT = 100;
const PLATFORM_FEE_PERCENT = 25;
const CUSTOMER_PERCENT = PERCENT + PLATFORM_FEE_PERCENT;
const EXAMPLE_RATE_USD = 1;
const EXAMPLE_FEE_USD = (EXAMPLE_RATE_USD * PLATFORM_FEE_PERCENT) / PERCENT;

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
});

const feeExample = [
	['You earn', `${usd.format(EXAMPLE_RATE_USD)}/h`, false],
	['Platform fee', `+${usd.format(EXAMPLE_FEE_USD)}/h`, false],
	[
		'Customer pays',
		`${usd.format(EXAMPLE_RATE_USD + EXAMPLE_FEE_USD)}/h`,
		true,
	],
] as const;

const hostFacts = [
	[
		'01',
		'Rates',
		'Your rates, your call.',
		'Price vCPU, memory, GPU, disk, and data transfer.',
	],
	[
		'02',
		'Payouts',
		'Paid every Monday.',
		'Weekly through Stripe once you reach $50.',
	],
	[
		'03',
		'Trust tiers',
		'Reliability pays sooner.',
		'Earnings clear in 14, 7, or 3 days by tier.',
	],
] as const;

const hostSteps = [
	['01', 'Sign up.', 'Create an account and connect Stripe for payouts.'],
	['02', 'Install.', null],
	['03', 'Approve.', 'Confirm the one-time code in the dashboard.'],
	['04', 'List.', 'Pass the benchmark, set your rates, and go public.'],
] as const;

const CELL_LABEL = `${MONO_FONT} mb-3 flex items-baseline justify-between text-[.65rem] uppercase tracking-widest text-snapflow-purple`;
const CELL_NUMBER = 'text-[.6rem] tracking-[.2em] text-snapflow-paper/20';
const CELL_TITLE = `${DISPLAY_FONT} text-[1.35rem] leading-[1.05]`;
const CELL_BODY = 'mt-3 text-[.8rem] leading-[1.6] text-snapflow-paper-dim';

function FeeSplit() {
	return (
		<figure className="m-0 flex w-full flex-col justify-center p-5 min-[769px]:p-8">
			<div className={CELL_LABEL}>
				<span>The split</span>
			</div>
			<h3 className={CELL_TITLE}>
				Keep 100% of your rate. Our fee goes on top.
			</h3>
			<div
				className={`${MONO_FONT} mt-8 flex h-14 text-[.6rem] uppercase tracking-widest min-[481px]:text-[.65rem]`}
				aria-hidden="true"
			>
				<div
					className="flex items-center bg-snapflow-purple px-3 font-bold text-snapflow-ink min-[481px]:px-4"
					style={{ width: `${(PERCENT / CUSTOMER_PERCENT) * PERCENT}%` }}
				>
					Your rate · {PERCENT}% yours
				</div>
				<div className="flex flex-1 items-center justify-center bg-[repeating-linear-gradient(135deg,var(--snapflow-surface-raised)_0_6px,var(--snapflow-card)_6px_12px)] text-snapflow-paper/70">
					+{PLATFORM_FEE_PERCENT}%
				</div>
			</div>
			<div
				className={`${MONO_FONT} mt-2 flex items-center gap-3 text-[.6rem] uppercase tracking-widest text-snapflow-paper/40`}
				aria-hidden="true"
			>
				<span className="h-px flex-1 bg-snapflow-paper/15" />
				<span className="shrink-0">
					Customer price · {CUSTOMER_PERCENT}% of your rate
				</span>
				<span className="h-px flex-1 bg-snapflow-paper/15" />
			</div>
			<figcaption
				className={`${MONO_FONT} mt-8 text-[.6rem] uppercase tracking-[.2em] text-snapflow-paper/40`}
			>
				Example at a {usd.format(EXAMPLE_RATE_USD)}/h rate
			</figcaption>
			<dl
				className={`${MONO_FONT} m-0 mt-2 grid text-[.75rem] min-[481px]:grid-cols-3 min-[481px]:gap-x-6`}
			>
				{feeExample.map(([label, value, accent]) => (
					<div
						key={label}
						className="flex items-baseline justify-between gap-4 border-snapflow-paper/8 border-b py-2.5"
					>
						<dt className="uppercase tracking-[.08em] text-snapflow-paper/45">
							{label}
						</dt>
						<dd
							className={`m-0 ${accent ? 'text-snapflow-purple' : 'text-snapflow-paper/80'}`}
						>
							{value}
						</dd>
					</div>
				))}
			</dl>
		</figure>
	);
}

export function HostsSection() {
	return (
		<AnimatedSection id="hosts">
			<div className={`${CONTENT_WIDTH} px-0`}>
				<div className="overflow-hidden border-snapflow-border border-b">
					<div className="px-5 py-6 min-[769px]:p-8 lg:p-12 lg:pb-10">
						<Badge icon="hosts" className="mx-auto">
							Hosts
						</Badge>
						<h2
							className={`${DISPLAY_FONT} mt-8 text-[clamp(3rem,5vw,4.5rem)] leading-[.92] tracking-[-.03em]`}
						>
							Your machine. Your price.
							<br />
							Paid weekly.
						</h2>
						<p className="mt-6 max-w-150 text-base leading-[1.6] text-snapflow-paper-dim">
							Rent out a Linux machine for isolated sandboxes and keep every
							dollar of your rate.
						</p>
					</div>

					<div className="grid border-snapflow-border border-t min-[769px]:grid-cols-3">
						<div className="order-2 flex border-snapflow-border min-[769px]:order-1 min-[769px]:col-span-2 min-[769px]:border-r">
							<FeeSplit />
						</div>
						<div className="relative order-1 flex min-h-75 items-center justify-center overflow-hidden border-snapflow-border border-b min-[769px]:order-2 min-[769px]:min-h-105 min-[769px]:border-b-0">
							<div className="size-70 min-[769px]:size-95">
								<HostMachine />
							</div>
						</div>
					</div>

					<div className="grid border-snapflow-border border-t min-[769px]:grid-cols-3">
						{hostFacts.map(([number, label, title, copy]) => (
							<article
								key={number}
								className="border-snapflow-border border-b p-5 last:border-b-0 min-[769px]:border-b-0 min-[769px]:p-8 min-[769px]:[&:not(:last-child)]:border-r"
							>
								<div className={CELL_LABEL}>
									<span>{label}</span>
									<span className={CELL_NUMBER}>{number}</span>
								</div>
								<h3 className={CELL_TITLE}>{title}</h3>
								<p className={CELL_BODY}>{copy}</p>
							</article>
						))}
					</div>

					<ol className="m-0 grid list-none border-snapflow-border border-t p-0 min-[481px]:grid-cols-2 lg:grid-cols-4">
						{hostSteps.map(([number, title, copy]) => (
							<li
								key={number}
								className="border-snapflow-border border-b p-5 last:border-b-0 min-[481px]:[&:nth-child(odd)]:border-r min-[481px]:[&:nth-last-child(-n+2)]:border-b-0 min-[769px]:p-8 lg:[&:not(:last-child)]:border-r"
							>
								<span
									className={`${MONO_FONT} block text-[.7rem] font-bold text-snapflow-purple leading-[normal]`}
								>
									[ {number} ]
								</span>
								<h3 className={`${CELL_TITLE} mt-3`}>{title}</h3>
								<p className={CELL_BODY}>
									{copy ?? (
										<>
											Run{' '}
											<code
												className={`${MONO_FONT} break-all border border-snapflow-purple/25 bg-snapflow-purple/10 px-1.5 py-0.5 text-[.72rem] text-snapflow-paper`}
											>
												{SETUP_COMMAND}
											</code>{' '}
											on the machine.
										</>
									)}
								</p>
							</li>
						))}
					</ol>

					<p
						className={`${MONO_FONT} m-0 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-snapflow-border border-t px-5 py-4 text-[.65rem] uppercase tracking-widest text-snapflow-paper/40 min-[769px]:px-8`}
					>
						<span>Runs on Linux (x86_64 or arm64) with KVM</span>
						<a
							href="#faq"
							className="text-snapflow-purple transition-colors hover:text-snapflow-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple"
						>
							Full requirements in the FAQ →
						</a>
					</p>
				</div>
			</div>
		</AnimatedSection>
	);
}
