/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { NightShift } from '@/components/landing/visuals/night-shift/night-shift';
import {
	DISPLAY_FONT,
	MONO_FONT,
	PANEL,
	PANEL_CELL,
	SCENE_CELL,
} from '@/lib/marketing-styles';

const STEP_DURATION_MS = 6000;

const approaches = [
	{
		title: 'Connect',
		scene: 'connect',
		heading: 'Connect your machine.',
		paragraphs: [
			'Install Snapflow and link the machine to your account with a one-time code.',
			'Snapflow benchmarks the machine before it is listed for work.',
		],
	},
	{
		title: 'Limits',
		scene: 'limits',
		heading: 'Set its limits.',
		paragraphs: [
			'Choose how much CPU, memory, storage, and supported GPU capacity Snapflow can use.',
			'On supported machines, sandboxes run in microVMs separate from the machine and one another.',
		],
	},
	{
		title: 'Control',
		scene: 'control',
		heading: 'Choose when it works.',
		paragraphs: [
			'Make the machine available when it suits you, and pause new work when you need the machine back.',
			'See its status, current work, and resource use from the dashboard.',
		],
	},
] as const;

export function ApproachStepper({ children }: { children: ReactNode }) {
	const [active, setActive] = useState(0);
	const [paused, setPaused] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const pause = () => setPaused(true);
		const resume = () => setPaused(false);
		container.addEventListener('mouseenter', pause);
		container.addEventListener('mouseleave', resume);
		return () => {
			container.removeEventListener('mouseenter', pause);
			container.removeEventListener('mouseleave', resume);
		};
	}, []);
	useEffect(() => {
		if (paused) return;
		const timer = window.setInterval(
			() => setActive((value) => (value + 1) % approaches.length),
			STEP_DURATION_MS
		);
		return () => clearInterval(timer);
	}, [paused]);
	return (
		<div
			data-night-shift-scene
			className={`${PANEL} grid lg:grid-cols-12`}
			ref={containerRef}
		>
			<div className="max-lg:contents lg:col-span-5 lg:flex lg:flex-col lg:border-snapflow-border lg:border-r">
				<div className={PANEL_CELL}>{children}</div>
				<div className="grid border-snapflow-border border-t max-lg:order-2 lg:mt-auto">
					{approaches.map((item, index) => (
						<button
							key={item.title}
							type="button"
							onClick={() => setActive(index)}
							className="relative flex w-full flex-col justify-start overflow-visible border-snapflow-border border-b px-5 py-5 text-left last:border-b-0 focus-visible:outline-2 focus-visible:outline-snapflow-purple min-[769px]:px-8 min-[769px]:py-6 lg:px-12"
						>
							<span className="absolute inset-y-0 left-px w-0.5">
								<span
									key={`${item.title}-${active === index ? 'active' : 'idle'}`}
									className={`block w-full bg-snapflow-purple ${active === index ? 'animate-[snapflow-progress_6s_linear_forwards]' : 'h-0'}`}
									style={{ animationPlayState: paused ? 'paused' : 'running' }}
								/>
							</span>
							<div className="flex flex-col gap-2">
								<span
									className={`${MONO_FONT} text-[.6rem] uppercase tracking-[.2em] ${active === index ? 'text-snapflow-purple' : 'text-snapflow-paper/50'}`}
								>
									Step 0{index + 1}
								</span>
								<h3
									className={`${DISPLAY_FONT} text-[clamp(1.4rem,2.2vw,1.85rem)] leading-[1.05] transition-colors duration-400 ${active === index ? 'text-snapflow-paper' : 'text-snapflow-paper/50'}`}
								>
									{item.heading}
								</h3>
							</div>
							<div
								className={`grid transition-[grid-template-rows,opacity] duration-400 min-[769px]:grid-rows-[1fr] ${active === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 min-[769px]:opacity-75'}`}
							>
								<div className="overflow-hidden">
									{item.paragraphs.map((paragraph, paragraphIndex) => (
										<p
											key={paragraph}
											className={`${paragraphIndex === 0 ? 'mt-4' : 'mt-2'} text-[.9rem] leading-[1.7] text-snapflow-paper-dim max-[768px]:text-[.85rem]`}
										>
											{paragraph}
										</p>
									))}
								</div>
							</div>
						</button>
					))}
				</div>
			</div>
			<div
				data-night-shift-frame
				className={`${SCENE_CELL} aspect-square border-t max-lg:order-1 lg:col-span-7 lg:aspect-auto lg:min-h-160 lg:border-t-0`}
			>
				<NightShift step={approaches[active]?.scene ?? approaches[0].scene} />
			</div>
		</div>
	);
}
