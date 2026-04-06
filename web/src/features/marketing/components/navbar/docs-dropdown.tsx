/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BookOpen, BotIcon, GithubIcon } from 'lucide-react';

const PREVIEW_CARDS = [
	{
		title: 'Introduction',
		href: 'https://docs.snapflow.io',
		image: '/landing/docs-getting-started.svg',
	},
	{
		title: 'Getting Started',
		href: 'https://docs.snapflow.io/getting-started',
		image: '/landing/docs-intro.svg',
	},
] as const;

const RESOURCE_CARDS = [
	{
		title: 'Sandboxes',
		description: 'Run code securely',
		href: 'https://docs.snapflow.io/sandboxes',
		icon: BotIcon,
	},
	{
		title: 'API Reference',
		description: 'REST & SDK docs',
		href: 'https://docs.snapflow.io/api',
		icon: BookOpen,
	},
	{
		title: 'Self-hosting',
		description: 'Host on your infra',
		href: 'https://docs.snapflow.io/self-hosting',
		icon: GithubIcon,
	},
] as const;

export function DocsDropdown() {
	return (
		<div className="w-120 rounded-[5px] border border-border bg-bg p-4 shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
			<div className="grid grid-cols-2 gap-2.5">
				{PREVIEW_CARDS.map((card) => (
					<a
						key={card.title}
						href={card.href}
						target="_blank"
						rel="noopener noreferrer"
						className="group/card overflow-hidden rounded-[5px] border border-border bg-bg transition-colors hover:border-border-1 hover:bg-surface-active"
					>
						<div className="h-30 w-full overflow-hidden bg-[#141414]">
							<img
								src={card.image}
								alt={card.title}
								decoding="async"
								className="h-full w-full scale-[1.04] object-cover transition-transform duration-200 group-hover/card:scale-[1.06]"
							/>
						</div>
						<div className="px-2.5 py-2">
							<span className="font-[430] font-season text-[13px] text-text-secondary">
								{card.title}
							</span>
						</div>
					</a>
				))}
			</div>

			<div className="mt-2 grid grid-cols-3 gap-2">
				{RESOURCE_CARDS.map((card) => {
					const Icon = card.icon;
					return (
						<a
							key={card.title}
							href={card.href}
							target="_blank"
							rel="noopener noreferrer"
							className="flex flex-col gap-1 rounded-[5px] border border-border px-2.5 py-2 transition-colors hover:border-border-1 hover:bg-surface-2"
						>
							<div className="flex items-center gap-1.5">
								<Icon className="h-3.25 w-3.25 shrink-0 text-text-icon" />
								<span className="font-[430] font-season text-[12px] text-text-secondary">
									{card.title}
								</span>
							</div>
							<span className="font-season text-[11px] text-text-icon leading-[130%]">
								{card.description}
							</span>
						</a>
					);
				})}
			</div>
		</div>
	);
}
