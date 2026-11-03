/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Path } from '@/constants/paths';
import {
	CHAMFER_CLIP,
	CONTENT_WIDTH,
	DISPLAY_FONT,
	HERO_BUTTON,
	HERO_BUTTON_BASE,
} from '@/lib/marketing-styles';

const tickerItems = [
	['sandboxes', 'Sandboxes'],
	['separator-1', '•'],
	['oci-images', 'Container images'],
	['separator-2', '•'],
	['per-second', 'Usage by the second'],
	['separator-3', '•'],
	['cpu-gpu', 'CPU + GPU'],
	['separator-4', '•'],
	['commands-shells', 'Commands + shells'],
	['separator-5', '•'],
	['http-tcp', 'HTTP + TCP'],
	['separator-6', '•'],
	['storage', 'Volumes + snapshots'],
	['separator-7', '•'],
	['recovery', 'Backups + releases'],
	['separator-8', '•'],
] as const;

const tickerGroups = [0, 1, 2, 3] as const;

export function HeroSection() {
	return (
		<section
			id="top"
			className="relative z-10 flex min-h-[calc(50vh-86px)] w-full flex-col overflow-hidden bg-transparent text-snapflow-ink max-md:min-h-[calc(50vh-70px)]"
		>
			<div
				className={`${CONTENT_WIDTH} relative z-10 flex flex-1 flex-col items-start justify-center`}
			>
				<h1
					className={`${DISPLAY_FONT} mt-8 mb-8 text-[clamp(3.5rem,7vw,7rem)] leading-[.88] tracking-[-.04em] max-md:text-[clamp(3.5rem,12vw,7rem)]`}
				>
					Deploy apps.
					<br />
					Powered by many.
				</h1>
				<p className="mb-10 max-w-135 text-[1.15rem] font-semibold leading-[1.6] opacity-85 max-md:text-base">
					Snapflow is a marketplace of independently operated machines. Compare
					them, pick one, and deploy—for quick jobs, temporary sandboxes,
					always-on apps, and everything in between.
				</p>
				<div className="mb-12 flex gap-4 max-md:w-full max-md:flex-wrap">
					<a
						href={Path.DASHBOARD_SIGNUP}
						className={`${HERO_BUTTON} bg-snapflow-ink text-snapflow-paper`}
					>
						Get Started
					</a>
					<a
						href={Path.DOCS}
						className={`${HERO_BUTTON_BASE} bg-snapflow-ink/30 p-0.5 text-snapflow-ink ${CHAMFER_CLIP}`}
					>
						<span
							className={`flex w-full items-center justify-center bg-snapflow-purple-hero px-8 py-4 ${CHAMFER_CLIP} max-md:py-5`}
						>
							Read the docs
						</span>
					</a>
				</div>
			</div>
			<div className="relative z-10 overflow-hidden border-snapflow-ink/15 border-t py-3">
				<div className="flex w-max animate-[snapflow-ticker_18s_linear_infinite] whitespace-nowrap font-['Geist_Pixel_Square',monospace] text-[.8rem] text-snapflow-ink uppercase tracking-widest opacity-70 [-webkit-text-stroke:.5px_var(--snapflow-ink)] will-change-transform">
					{tickerGroups.map((group) => (
						<div
							key={group}
							className="flex shrink-0 gap-16 pr-16 max-md:gap-8 max-md:pr-8"
							aria-hidden={group > 0 ? true : undefined}
						>
							{tickerItems.map(([id, label]) => (
								<span key={`${group}-${id}`}>{label}</span>
							))}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
