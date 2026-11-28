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
import { useInView } from '@/hooks/use-in-view';
import { useTypingAnimation } from '@/hooks/use-typing-animation';
import {
	CONTENT_WIDTH,
	MONO_FONT,
	PANEL,
	PANEL_CELL,
	SECTION_INSET,
	SECTION_SPACE,
} from '@/lib/marketing-styles';

const phrases = [
	'await sandbox.run("npm test")',
	'await sandbox.process.start(...)',
	'await sandbox.exposures.create(...)',
	'await sandbox.snapshots.create(...)',
	'await sandbox.stop()',
	'await sandbox.start()',
] as const;

const TERMINAL_LINE =
	'opacity-0 animate-[snapflow-terminal-line_.01s_step-end_forwards]';

const annotations = [
	['Sandbox lifecycle', 'Create · start · stop · delete'],
	['Resources', 'CPU · memory · disk · GPU'],
	['Remote execution', 'Commands · shell · output'],
	['Networking', 'Ports · domains · access'],
	['Persistent data', 'Volumes · snapshots · backups'],
	['Releases', 'Images · templates · revisions'],
] as const;

const chassisSlots = [
	'slot-a',
	'slot-b',
	'slot-c',
	'slot-d',
	'slot-e',
] as const;
const windowControls = [
	'control-close',
	'control-minimize',
	'control-maximize',
] as const;

const snapflowAscii = `███████╗███╗   ██╗ █████╗ ██████╗ ███████╗██╗      ██████╗ ██╗    ██╗
██╔════╝████╗  ██║██╔══██╗██╔══██╗██╔════╝██║     ██╔═══██╗██║    ██║
███████╗██╔██╗ ██║███████║██████╔╝█████╗  ██║     ██║   ██║██║ █╗ ██║
╚════██║██║╚██╗██║██╔══██║██╔═══╝ ██╔══╝  ██║     ██║   ██║██║███╗██║
███████║██║ ╚████║██║  ██║██║     ██║     ███████╗╚██████╔╝╚███╔███╔╝
╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝`;

const ANNOTATION_PLACEMENT = [
	'xl:col-start-1 xl:row-start-1 xl:text-right',
	'xl:col-start-3 xl:row-start-1 xl:text-left',
	'xl:col-start-1 xl:row-start-2 xl:text-right',
	'xl:col-start-3 xl:row-start-2 xl:text-left',
	'xl:col-start-1 xl:row-start-3 xl:text-right',
	'xl:col-start-3 xl:row-start-3 xl:text-left',
] as const;

function TerminalAnnotations() {
	return (
		<div className="contents">
			{annotations.map(([title, description], index) => (
				<div
					key={title}
					className={`flex flex-col justify-center border-snapflow-border p-5 text-center min-[769px]:p-8 ${ANNOTATION_PLACEMENT[index]} ${index % 2 === 0 ? 'border-r xl:border-r-0' : ''} ${index < 4 ? 'border-b' : ''}`}
				>
					<div className="font-['Geist_Pixel_Square'] mb-2 text-[.72rem] uppercase tracking-widest text-snapflow-paper">
						{title}
					</div>
					<div className="font-['Geist_Pixel_Square'] text-[.65rem] uppercase leading-normal tracking-widest text-snapflow-paper/50">
						{description}
					</div>
				</div>
			))}
		</div>
	);
}

function TypingPrompt() {
	const { ref, visible } = useInView<HTMLDivElement>();
	const typed = useTypingAnimation(phrases, visible);

	return (
		<div
			ref={ref}
			className={`${TERMINAL_LINE} flex min-h-[1.8em] min-w-0 items-center overflow-hidden pt-3 whitespace-nowrap text-[.7rem] [animation-delay:4.8s] md:text-[.85rem]`}
		>
			<span className="shrink-0 text-snapflow-purple">λ</span>
			<span className="ml-[.6ch]">{typed}</span>
			<span className="ml-1 inline-block h-3.75 w-2 shrink-0 animate-[snapflow-cursor_1s_step-end_infinite] bg-snapflow-purple align-middle" />
		</div>
	);
}

export function TerminalSection() {
	return (
		<AnimatedSection
			className={`${SECTION_SPACE} relative [clip-path:inset(0_1.25rem)] min-[769px]:[clip-path:inset(0_5%)] min-[1281px]:[clip-path:inset(0_calc(50%-600px))]`}
		>
			<div className={`${CONTENT_WIDTH} ${SECTION_INSET}`}>
				<SectionHeading
					eyebrow="TypeScript SDK"
					title="Dashboard or API. Same platform."
					icon="terminal"
				/>
			</div>
			<div
				className={`${PANEL} mt-10 grid grid-cols-2 min-[769px]:mt-14 xl:grid-cols-[15rem_minmax(0,1fr)_15rem] xl:grid-rows-3`}
			>
				<div
					className={`${PANEL_CELL} col-span-2 border-snapflow-border border-b xl:col-span-1 xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:border-x xl:border-b-0`}
				>
					<div className="relative mx-auto w-full max-w-170">
						<div className="relative rounded-[10px] border border-snapflow-border bg-[linear-gradient(160deg,var(--snapflow-surface-raised),var(--snapflow-surface),var(--snapflow-surface-muted))] p-5 shadow-[0_2px_0_color-mix(in_srgb,var(--snapflow-paper)_4%,transparent),0_-1px_var(--snapflow-shadow),0_20px_60px_var(--snapflow-shadow-soft)]">
							<div className="mb-3 flex gap-1">
								{chassisSlots.map((slot) => (
									<span
										key={slot}
										className="h-0.75 flex-1 rounded-[1px] bg-snapflow-paper/4"
									/>
								))}
							</div>
							<div className="flex aspect-16/12 flex-col overflow-hidden rounded-md border-2 border-snapflow-border shadow-[inset_0_2px_8px_var(--snapflow-shadow)] max-md:aspect-auto">
								<div className="relative flex flex-1 flex-col overflow-hidden bg-snapflow-terminal">
									<div className="relative flex items-center border-snapflow-border border-b bg-snapflow-paper/2 px-5 py-3">
										<span className="flex gap-1.5">
											{windowControls.map((control) => (
												<i
													key={control}
													className="size-2 rounded-full bg-snapflow-paper/15"
												/>
											))}
										</span>
										<span
											className={`${MONO_FONT} absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[.55rem] uppercase tracking-widest text-snapflow-paper/30 min-[481px]:text-[.65rem] md:text-[.75rem]`}
										>
											snapflow://network · connected
										</span>
										<i className="ml-auto size-1.5 bg-snapflow-purple/50" />
									</div>
									<div
										className={`${MONO_FONT} flex-1 p-4 text-[.75rem] leading-[1.8] md:p-7 md:text-[.85rem]`}
									>
										<div className={`${TERMINAL_LINE} [animation-delay:.4s]`}>
											<span className="text-snapflow-purple">λ</span>{' '}
											<span>pnpm add @snapflow/sdk</span>
										</div>
										<div
											className={`${TERMINAL_LINE} pt-2 [animation-delay:1s]`}
										>
											<pre
												className={`${MONO_FONT} m-0 text-[clamp(.29rem,1.22vw,.5rem)] leading-tight tracking-[-.04em] text-snapflow-paper/20`}
											>
												{snapflowAscii}
											</pre>
										</div>
										<div
											className={`${TERMINAL_LINE} pt-2 text-snapflow-paper/40 [animation-delay:1.8s]`}
										>
											&gt; @snapflow/sdk installed
										</div>
										<div
											className={`${TERMINAL_LINE} text-snapflow-paper/40 [animation-delay:2.4s]`}
										>
											&gt; API key loaded
										</div>
										<div
											className={`${TERMINAL_LINE} text-snapflow-paper/40 [animation-delay:3.2s]`}
										>
											<span className="text-snapflow-purple">λ</span>{' '}
											<span>node create-sandbox.mjs</span>
										</div>
										<div
											className={`${TERMINAL_LINE} text-snapflow-paper/40 [animation-delay:3.6s]`}
										>
											&gt; Planning sandbox...
										</div>
										<div
											className={`${TERMINAL_LINE} pt-3 [animation-delay:4.2s]`}
										>
											<span className="text-snapflow-purple">✓</span> api
											running.{' '}
											<span className="text-[.75rem] text-snapflow-paper/30">
												Usage tracking:{' '}
												<span className="text-snapflow-purple">ON</span> ·
												Price:{' '}
												<span className="text-snapflow-purple">LOCKED</span>
											</span>
										</div>
										<TypingPrompt />
									</div>
								</div>
							</div>
							<div
								className={`${MONO_FONT} mt-5 grid grid-cols-[1fr_auto_1fr_1fr] items-center border-snapflow-border border-t pt-4 pb-2 text-[.6rem] uppercase tracking-[.2em] text-snapflow-paper/20`}
							>
								<span>SDK controls</span>
								<i className="mx-3 size-1 rounded-full bg-snapflow-purple/50" />
								<span className="text-center text-snapflow-purple/50">
									SF-SDK
								</span>
								<span className="text-right">Network Live</span>
							</div>
						</div>
					</div>
				</div>
				<TerminalAnnotations />
			</div>
		</AnimatedSection>
	);
}
