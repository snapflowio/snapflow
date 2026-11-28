/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { formatUsd, PRICING } from '@/data/pricing';

export const FAQS = [
	[
		'What is Snapflow?',
		'A marketplace for compute. Independent hosts rent out their machines, and you run code on them in isolated sandboxes through the SDK or API.',
	],
	[
		'How much does it cost?',
		`Every machine shows one hourly price: the host's rate plus a ${PRICING.FEE_PERCENT}% Snapflow fee. You pay by the second in USDC while it runs and only for disk when stopped. Archived sandboxes pay storage at ${formatUsd(PRICING.STORAGE_USD_PER_GIB_MONTH)} per GiB-month. Traffic is included, and your own machines are free.`,
	],
	[
		'Do I need crypto?',
		'You pay in USDC, a dollar-backed stablecoin. Send it on Base from an exchange or a wallet you already have.',
	],
	[
		"Is my code safe on someone else's machine?",
		"Each workload runs in its own microVM, walled off from the host's system and network. Hosts can still technically reach what runs on their machine, so don't run anything that must stay secret from them.",
	],
	[
		'What if a machine goes offline?',
		'Your workload moves to another matching machine from its latest backup. If you picked the machine yourself, you choose whether to wait or move.',
	],
	[
		'How do hosts get paid?',
		`Hosts set one hourly price per machine and a lower interruptible rate, and earn all of both; customers pay a ${PRICING.FEE_PERCENT}% Snapflow fee on top. Earnings arrive in USDC in a wallet only the host controls, less a small network fee for each payout.`,
	],
	[
		'Can my machine be a host?',
		'Any Linux machine (x86_64 or arm64) with virtualization turned on and a solid connection. NVIDIA GPUs are supported, and setup checks your machine before it is listed.',
	],
	[
		'Can I still use my machine?',
		'Yes. You choose how much of it to share and can pause new work whenever you need it back.',
	],
] as const;
