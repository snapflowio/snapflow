/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect, useState } from 'react';
import { BandShader } from '@/components/landing/visuals/band-shader';
import { DISPLAY_FONT, MONO_FONT } from '@/lib/marketing-styles';

const approaches = [
	{
		title: 'Connect',
		heading: 'Connect your machine.',
		paragraphs: [
			'Install Snapflow and link the machine to your account with a one-time code.',
			'Snapflow benchmarks the machine before it is listed for work.',
		],
	},
	{
		title: 'Limits',
		heading: 'Set its limits.',
		paragraphs: [
			'Choose how much CPU, memory, storage, and supported GPU capacity Snapflow can use.',
			'On supported machines, sandboxes run in microVMs separate from the machine and one another.',
		],
	},
	{
		title: 'Control',
		heading: 'Choose when it works.',
		paragraphs: [
			'Make the machine available when it suits you, and pause new work when you need the machine back.',
			'See its status, current work, and resource use from the dashboard.',
		],
	},
] as const;

function ProofRow({
	label,
	value,
	accent = false,
}: {
	label: string;
	value: string;
	accent?: boolean;
}) {
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-snapflow-paper/8 border-b py-2.5 last:border-b-0">
			<span className="min-w-0 text-snapflow-paper/45 uppercase tracking-[.08em]">
				{label}
			</span>
			<span
				className={`text-right uppercase ${accent ? 'text-snapflow-purple' : 'text-snapflow-paper/80'}`}
			>
				{value}
			</span>
		</div>
	);
}

function QualificationProof() {
	return (
		<>
			<div className="text-snapflow-paper/45 uppercase tracking-widest">
				Machine setup
			</div>
			<div className="mt-1 text-snapflow-paper/80 uppercase">
				Machine · system · connection
			</div>
			<div className="my-4 text-center text-snapflow-purple">↓</div>
			<ProofRow label="Machine" value="Ready" />
			<ProofRow label="System" value="Ready" />
			<ProofRow label="Connection" value="Ready" />
			<ProofRow label="Machine" value="Available" accent />
			<p className="mt-5 border-snapflow-purple/20 border-t pt-4 text-snapflow-paper/70 uppercase tracking-widest">
				Listed on the marketplace.
			</p>
		</>
	);
}

function LimitsProof() {
	return (
		<>
			<div className="mb-2 text-snapflow-paper/45 uppercase tracking-widest">
				Shared resources
			</div>
			<ProofRow label="CPU limit" value="Set by host" accent />
			<ProofRow label="Memory limit" value="Set by host" />
			<ProofRow label="Storage limit" value="Set by host" />
			<ProofRow label="Machine status" value="Host controlled" />
			<p className="mt-5 border-snapflow-purple/20 border-t pt-4 text-snapflow-paper/70 uppercase tracking-widest">
				Share only what you choose.
			</p>
		</>
	);
}

function ControlProof() {
	return (
		<>
			<div className="mb-2 text-snapflow-paper/45 uppercase tracking-widest">
				Machine activity
			</div>
			<ProofRow label="Status" value="Online" accent />
			<ProofRow label="New work" value="Accepting" />
			<ProofRow label="Current work" value="Visible" />
			<ProofRow label="Resource use" value="Recorded" />
			<div className="my-5 flex items-center justify-between gap-2 text-snapflow-paper/80 uppercase tracking-[.06em]">
				<span>Available</span>
				<span className="text-snapflow-purple">→</span>
				<span>Paused</span>
			</div>
			<div className="border-snapflow-purple/20 border-t pt-4 uppercase tracking-widest">
				<p className="text-snapflow-paper/70">
					You decide when the machine participates.
				</p>
			</div>
		</>
	);
}

function ApproachCard({ active }: { active: number }) {
	return (
		<div
			className={`${MONO_FONT} relative z-10 h-auto w-[90%] max-w-95 overflow-hidden rounded-md border border-snapflow-purple bg-snapflow-ink/88 px-8 py-7 text-[.7rem] leading-[1.8] text-snapflow-paper/45 backdrop-blur-md`}
		>
			<span className="block border-snapflow-purple/12 border-b pb-3 text-[.65rem] text-snapflow-paper uppercase tracking-[.15em]">
				{approaches[active]?.title}
			</span>
			<div
				key={active}
				className="mt-5 animate-[snapflow-card-in_.4s_ease-out]"
			>
				{active === 0 && <QualificationProof />}
				{active === 1 && <LimitsProof />}
				{active === 2 && <ControlProof />}
			</div>
		</div>
	);
}

export function ApproachStepper() {
	const [active, setActive] = useState(0);
	const [paused, setPaused] = useState(false);
	useEffect(() => {
		if (paused) return;
		const timer = window.setInterval(
			() => setActive((value) => (value + 1) % approaches.length),
			6000
		);
		return () => clearInterval(timer);
	}, [paused]);
	return (
		<div
			className="mt-12 grid items-start min-[769px]:grid-cols-2 lg:grid-cols-[2fr_3fr]"
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
		>
			<div className="flex flex-col">
				{approaches.map((item, index) => (
					<button
						key={item.title}
						type="button"
						onClick={() => setActive(index)}
						className="relative block w-full overflow-visible border-snapflow-border border-t py-6 pr-8 pl-5 text-left last:border-b focus-visible:outline-2 focus-visible:outline-snapflow-purple max-[768px]:border-r max-[768px]:py-5 max-[768px]:pr-5 max-[768px]:pl-4"
					>
						<span className="absolute inset-y-0 left-0 w-0.5 bg-snapflow-paper/4">
							<span
								key={`${item.title}-${active === index ? 'active' : 'idle'}`}
								className={`block w-full bg-snapflow-purple ${active === index ? 'animate-[snapflow-progress_6s_linear_forwards]' : 'h-0'}`}
								style={{ animationPlayState: paused ? 'paused' : 'running' }}
							/>
						</span>
						<div className="flex flex-col gap-2">
							<span
								className={`${MONO_FONT} text-[.6rem] uppercase tracking-[.2em] ${active === index ? 'text-snapflow-purple' : 'text-snapflow-paper/20'}`}
							>
								Step 0{index + 1}
							</span>
							<h3
								className={`${DISPLAY_FONT} text-[clamp(1.5rem,2.5vw,2rem)] leading-[1.05] ${active === index ? 'text-snapflow-paper' : 'text-snapflow-paper/30'}`}
							>
								{item.heading}
							</h3>
						</div>
						<div
							className={`grid transition-[grid-template-rows,opacity] duration-400 ${active === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
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
			<div className="relative flex min-h-100 items-center justify-center overflow-hidden border border-snapflow-border bg-snapflow-paper/2 max-[768px]:border-b-0 min-[769px]:min-h-125 lg:min-h-170 lg:border-r-0">
				<BandShader variant="dark" contained trackPointer="parent" />
				<ApproachCard active={active} />
			</div>
		</div>
	);
}
