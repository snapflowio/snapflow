/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	COIN_RINGS_INNER_FRACTION,
	CoinRings,
} from '@/components/landing/visuals/coin-rings';
import { UsdcCoin } from '@/components/landing/visuals/usdc-coin/usdc-coin';
import { CAMERA } from '@/components/landing/visuals/usdc-coin/usdc-coin-config';
import {
	AnimatedSection,
	SectionHeading,
} from '@/components/ui/marketing-primitives';
import { formatUsd, PRICING } from '@/data/pricing';
import {
	CONTENT_WIDTH,
	MONO_FONT,
	PANEL,
	PANEL_CELL,
	SCENE_CELL,
	SECTION_SPACE,
} from '@/lib/marketing-styles';

const PERCENT = 100;
const COIN_RING_CLEARANCE = 0.9;
const COIN_BOX_FRACTION =
	(COIN_RINGS_INNER_FRACTION * COIN_RING_CLEARANCE) / CAMERA.coinFraction;
const COIN_BOX_INSET = `${((1 - COIN_BOX_FRACTION) / 2) * PERCENT}%`;

const hostFacts = [
	[
		'Your price',
		'Set one hourly price for the whole machine and a lower interruptible rate, and keep 100% of both.',
	],
	[
		'Customers',
		`They pay your price plus a ${PRICING.FEE_PERCENT}% Snapflow fee, billed by the second from a USDC escrow. Deposits start at ${formatUsd(PRICING.MINIMUM_DEPOSIT_USD)}.`,
	],
	[
		'Payouts',
		`USDC on Base, sent to a wallet only you control. Payouts start at ${formatUsd(PRICING.HOST_PAYOUT_MINIMUM_USD)}.`,
	],
	['Your own machines', 'Running sandboxes on machines you own is free.'],
] as const;

const CELL_LABEL = `${MONO_FONT} text-[.65rem] uppercase tracking-widest text-snapflow-purple`;
const CELL_BODY = 'mt-3 text-[.8rem] leading-[1.6] text-snapflow-paper-dim';
const FOOTER = `${MONO_FONT} m-0 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 text-[.65rem] uppercase tracking-widest text-snapflow-paper/40 min-[769px]:px-8 lg:px-12`;
const LINK =
	'text-snapflow-purple transition-colors hover:text-snapflow-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple';

export function HostsSection() {
	return (
		<AnimatedSection id="hosts" className={SECTION_SPACE}>
			<div className={`${PANEL} grid lg:grid-cols-12`}>
				<div
					className={`${SCENE_CELL} aspect-square border-t [container-type:size] max-lg:order-1 min-[769px]:aspect-2/1 lg:col-span-5 lg:row-span-2 lg:aspect-auto lg:border-t-0 lg:border-r`}
				>
					<div className="absolute top-1/2 left-1/2 size-[min(82cqw,82cqh)] -translate-x-1/2 -translate-y-1/2">
						<CoinRings />
						<div className="absolute" style={{ inset: COIN_BOX_INSET }}>
							<UsdcCoin />
						</div>
					</div>
				</div>
				<div className={`${PANEL_CELL} lg:col-span-7`}>
					<SectionHeading
						eyebrow="Hosts"
						title={'Your machine.\nYour price.\nPaid in USDC.'}
						body="Rent out a Linux machine for isolated sandboxes. Prices are in dollars and paid in USDC on Base."
						icon="hosts"
						align="left"
					/>
				</div>
				<dl className="m-0 grid border-snapflow-border border-t max-lg:order-2 min-[481px]:grid-cols-2 lg:col-span-7">
					{hostFacts.map(([label, copy]) => (
						<div
							key={label}
							className="border-snapflow-border border-b p-5 last:border-b-0 min-[481px]:odd:border-r min-[481px]:[&:nth-last-child(-n+2)]:border-b-0 min-[769px]:p-8 lg:px-12"
						>
							<dt className={CELL_LABEL}>{label}</dt>
							<dd className={`m-0 ${CELL_BODY}`}>{copy}</dd>
						</div>
					))}
				</dl>
			</div>
			<div className={CONTENT_WIDTH}>
				<div className="border-snapflow-border border-b">
					<p className={FOOTER}>
						<span>Runs on Linux (x86_64 or arm64) with KVM</span>
						<a href="#faq" className={LINK}>
							Full requirements in the FAQ →
						</a>
					</p>
				</div>
			</div>
		</AnimatedSection>
	);
}
