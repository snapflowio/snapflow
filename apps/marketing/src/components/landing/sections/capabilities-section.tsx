/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	AnimatedSection,
	SectionHeading,
} from '@/components/ui/marketing-primitives';
import {
	CARD_TITLE,
	CONTENT_WIDTH,
	DENSE_SECTION_SPACE,
	MONO_FONT,
	SECTION_INSET,
} from '@/lib/marketing-styles';

const capabilities = [
	[
		'01',
		'Run it once or keep it online.',
		'Start a job that stops when it is done, or keep an app, API, or game server running.',
	],
	[
		'02',
		'Choose what it needs.',
		'Set the CPU, memory, and storage, and add a GPU when needed. Then compare the machines that fit, nearest first.',
	],
	[
		'03',
		'Work inside it.',
		'Run commands, open a shell, follow logs, and move files through the SDK.',
	],
	[
		'04',
		'Put it online.',
		'Expose HTTP, TCP, or UDP ports. Use a Snapflow address or your own domain, with public or protected access.',
	],
	[
		'05',
		'Keep data between runs.',
		'Attach a volume, take snapshots, and schedule backups you can restore.',
	],
	[
		'06',
		'Update without starting over.',
		'Roll out a new container image, keep earlier versions, and return to one when needed.',
	],
] as const;

export function CapabilitiesSection() {
	return (
		<AnimatedSection id="capabilities" className={DENSE_SECTION_SPACE}>
			<div className={`${CONTENT_WIDTH} ${SECTION_INSET}`}>
				<SectionHeading
					eyebrow="Workloads"
					title="From quick jobs to always-on apps."
					icon="capabilities"
					align="left"
				/>
				<div className="mt-10 grid gap-4 min-[769px]:mt-14 min-[769px]:grid-cols-2 min-[769px]:gap-6 lg:grid-cols-3">
					{capabilities.map(([number, title, copy]) => (
						<article
							key={number}
							className="group relative bg-snapflow-border p-px transition-colors duration-300 [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)] hover:bg-snapflow-purple/60"
						>
							<div className="h-full bg-snapflow-card px-7.75 pt-9.75 pb-7.75 transition-colors duration-300 [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)] group-hover:bg-snapflow-card-hover max-[768px]:px-4.75 max-[768px]:pt-5.75 max-[768px]:pb-4.75">
								<span
									className={`${MONO_FONT} block text-[.7rem] font-bold text-snapflow-purple leading-[normal]`}
								>
									[ {number} ]
								</span>
								<h3 className={`${CARD_TITLE} mt-3`}>{title}</h3>
								<p className="mt-3 text-[.85rem] leading-[1.6] text-snapflow-paper-dim">
									{copy}
								</p>
							</div>
						</article>
					))}
				</div>
			</div>
		</AnimatedSection>
	);
}
