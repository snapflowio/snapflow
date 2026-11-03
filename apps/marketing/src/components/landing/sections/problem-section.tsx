/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CloudLock } from '@/components/landing/visuals/cloud-lock';
import { AnimatedSection, Badge } from '@/components/ui/marketing-primitives';
import { CONTENT_WIDTH, DISPLAY_FONT, MONO_FONT } from '@/lib/marketing-styles';

const problems = [
	[
		'01',
		'Idle hardware',
		'Good machines sit unused',
		'Useful CPU and GPU capacity is already everywhere in homes, offices, and more; but most platforms were never built to use it.',
	],
	[
		'02',
		'Closed clouds',
		'Most clouds stop at their own fleet.',
		"Capacity outside a provider's regions, hardware catalog, and infrastructure remains out of reach.",
	],
	[
		'03',
		'The choosing problem',
		'Not every machine will do.',
		'Apps have requirements. Machines have limits. You need to see the specs, the price, and who runs a machine before you trust it with work.',
	],

	[
		'04',
		'The hard part',
		'Machines come and go. Apps should not.',
		'Machines can slow down, disconnect, or disappear. The platform has to detect failures and recover workloads somewhere else.',
	],
] as const;

export function ProblemSection() {
	return (
		<AnimatedSection id="problem">
			<div className={`${CONTENT_WIDTH} px-0`}>
				<div className="overflow-hidden">
					<div className="px-5 py-6 min-[769px]:p-8 lg:p-12 lg:pb-10">
						<Badge icon="problem" className="mx-auto">
							The problem
						</Badge>
						<h2
							className={`${DISPLAY_FONT} mt-8 text-[clamp(3rem,5vw,4.5rem)] leading-[.92] tracking-[-.03em]`}
						>
							Spare compute is everywhere.
							<br />A lot of it goes unused.
						</h2>
					</div>
					<div className="grid border-snapflow-border border-t min-[769px]:grid-cols-3 min-[769px]:grid-rows-2 min-[769px]:auto-rows-52.5">
						<div className="relative flex min-h-75 items-center justify-center overflow-hidden border-snapflow-border border-b min-[769px]:row-span-2 min-[769px]:min-h-105 min-[769px]:border-r min-[769px]:border-b-0">
							<div className="size-70 min-[769px]:size-95">
								<CloudLock />
							</div>
						</div>
						{problems.map(([number, label, title, copy], index) => (
							<article
								key={number}
								className={`border-snapflow-border border-b p-5 min-[769px]:p-8 ${index === 0 || index === 2 ? 'min-[769px]:border-r' : ''} ${index > 1 ? 'min-[769px]:border-b-0' : ''} last:border-b-0`}
							>
								<div
									className={`${MONO_FONT} mb-3 flex items-baseline justify-between text-[.65rem] uppercase tracking-widest text-snapflow-purple`}
								>
									<span>{label}</span>
									<span className="text-[.6rem] tracking-[.2em] text-snapflow-paper/20">
										{number}
									</span>
								</div>
								<h3 className={`${DISPLAY_FONT} text-[1.35rem] leading-[1.05]`}>
									{title}
								</h3>
								<p className="mt-3 text-[.8rem] leading-[1.6] text-snapflow-paper-dim">
									{copy}
								</p>
							</article>
						))}
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}
