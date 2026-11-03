/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AnimatedSection, Badge } from '@/components/ui/marketing-primitives';
import { CONTENT_WIDTH, DISPLAY_FONT, MONO_FONT } from '@/lib/marketing-styles';

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
		<AnimatedSection id="capabilities" className="py-16 min-[769px]:py-32">
			<div className={`${CONTENT_WIDTH} px-6`}>
				<Badge icon="capabilities" className="mx-auto mb-6">
					Workloads
				</Badge>
				<h2
					className={`${DISPLAY_FONT} mb-8 text-center text-[clamp(2.5rem,4vw,3.5rem)] leading-[.92] tracking-[-.03em]`}
				>
					From quick jobs to always-on apps.
				</h2>
				<div className="mt-16 grid gap-6 max-[768px]:mt-8 max-[768px]:gap-4 min-[769px]:grid-cols-2 min-[1025px]:grid-cols-3">
					{capabilities.map(([number, title, copy]) => (
						<article
							key={number}
							className="group relative bg-snapflow-border p-px transition-colors duration-300 [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)] hover:bg-snapflow-purple/20"
						>
							<div className="h-full bg-snapflow-card px-7.75 pt-9.75 pb-7.75 transition-colors duration-300 [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)] group-hover:bg-snapflow-card-hover max-[768px]:px-4.75 max-[768px]:pt-5.75 max-[768px]:pb-4.75">
								<span
									className={`${MONO_FONT} block text-[.7rem] font-bold text-snapflow-purple leading-[normal]`}
								>
									[ {number} ]
								</span>
								<h3
									className={`${DISPLAY_FONT} mt-3 text-[1.35rem] leading-[1.1] tracking-[-.02em]`}
								>
									{title}
								</h3>
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
