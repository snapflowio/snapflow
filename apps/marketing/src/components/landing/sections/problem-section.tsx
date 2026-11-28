/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CloudLock } from '@/components/landing/visuals/cloud-lock';
import {
	AnimatedSection,
	SectionHeading,
} from '@/components/ui/marketing-primitives';
import {
	CARD_TITLE,
	MONO_FONT,
	PANEL,
	PANEL_CELL,
	SCENE_CELL,
	SECTION_SPACE,
} from '@/lib/marketing-styles';

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
		<AnimatedSection id="problem" className={SECTION_SPACE}>
			<div className={PANEL}>
				<div className="grid lg:grid-cols-12">
					<div className={`${PANEL_CELL} flex items-center lg:col-span-7`}>
						<SectionHeading
							eyebrow="The problem"
							title={'Spare compute is everywhere.\nA lot of it goes unused.'}
							icon="problem"
							align="left"
						/>
					</div>
					<div
						className={`${SCENE_CELL} flex items-center justify-center border-t py-8 lg:col-span-5 lg:border-t-0 lg:border-l`}
					>
						<div className="size-56 min-[769px]:size-72 lg:size-88">
							<CloudLock />
						</div>
					</div>
				</div>
				<div className="grid border-snapflow-border border-t min-[769px]:grid-cols-2 lg:grid-cols-4">
					{problems.map(([number, label, title, copy]) => (
						<article
							key={number}
							className="border-snapflow-border border-b p-5 last:border-b-0 min-[769px]:p-8 min-[769px]:odd:border-r min-[769px]:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:px-6 lg:[&:not(:last-child)]:border-r"
						>
							<div
								className={`${MONO_FONT} mb-3 flex items-baseline justify-between text-[.65rem] uppercase tracking-widest text-snapflow-purple`}
							>
								<span>{label}</span>
								<span className="text-[.6rem] tracking-[.2em] text-snapflow-paper/20">
									{number}
								</span>
							</div>
							<h3 className={CARD_TITLE}>{title}</h3>
							<p className="mt-3 text-[.8rem] leading-[1.6] text-snapflow-paper-dim">
								{copy}
							</p>
						</article>
					))}
				</div>
			</div>
		</AnimatedSection>
	);
}
