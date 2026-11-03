/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { FaqSection } from '@/components/landing/sections/faq-section';
import { SpaceBackground } from '@/components/landing/visuals/space-background';
import { SiteFooter } from '@/components/layout/site-footer';
import { SnapflowMark } from '@/components/ui/brand-marks';
import {
	AnimatedSection,
	MarketingButton,
} from '@/components/ui/marketing-primitives';
import { Path } from '@/constants/paths';
import {
	CONTENT_WIDTH,
	DISPLAY_FONT,
	SECTION_DIVIDER,
	TEXT_GLOW,
} from '@/lib/marketing-styles';

export function ClosingSection() {
	return (
		<>
			<FaqSection />
			<div className="relative h-16.25">
				<div className={`${SECTION_DIVIDER} absolute inset-x-0 top-0`} />
			</div>
			<AnimatedSection className="relative z-10000 isolate overflow-hidden border-snapflow-border border-t bg-snapflow-ink py-24 pb-32 text-center min-[769px]:pt-48 min-[769px]:pb-64">
				<SpaceBackground />
				<SnapflowMark
					outline
					strokeWidth={1}
					className="pointer-events-none absolute -right-25 -bottom-30 z-1 hidden size-225 text-snapflow-paper/8 opacity-[.04] md:block"
				/>
				<div className={`${CONTENT_WIDTH} relative z-10 px-5 md:px-0`}>
					<div className="relative z-30 isolate mx-auto mb-12 h-16 w-16.25">
						<div className="absolute -inset-7 -z-20 rounded-full bg-snapflow-ink/75 blur-2xl" />
						<div className="absolute -inset-5 -z-10 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--snapflow-purple)_40%,transparent)_0%,color-mix(in_srgb,var(--snapflow-purple)_15%,transparent)_38%,transparent_72%)] blur-md" />
						<SnapflowMark className="absolute inset-0 z-0 size-16 scale-125 animate-[snapflow-glow-pulse_3s_ease-in-out_infinite] text-snapflow-purple" />
						<SnapflowMark className="relative z-10 size-16 text-snapflow-purple-hero filter-[drop-shadow(0_0_8px_var(--snapflow-purple-hero))_drop-shadow(0_0_22px_color-mix(in_srgb,var(--snapflow-purple)_60%,transparent))]" />
					</div>
					<div className="relative isolate mx-auto w-fit">
						<div className="pointer-events-none absolute top-[20%] left-1/2 -z-10 h-[600%] w-[375%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,var(--snapflow-ink)_25%,transparent_60%)] opacity-60 blur-lg" />
						<h2
							className={`${DISPLAY_FONT} ${TEXT_GLOW} mx-auto mb-12 max-w-300 text-[clamp(2.5rem,8vw,7rem)] leading-[.9] tracking-[-.03em] min-[769px]:text-[clamp(4rem,8vw,7rem)]`}
						>
							Bring your app.
							<br />
							Pick your machine.
						</h2>
					</div>
					<MarketingButton
						href={Path.DASHBOARD_SIGNUP}
						className="w-full max-w-125 gap-3 py-8 text-[1.3rem] shadow-[0_0_40px_color-mix(in_srgb,var(--snapflow-purple)_40%,transparent)] max-md:py-5 max-md:text-base"
					>
						Get early access
						<svg
							className="size-4.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M20 4v8a4 4 0 0 1-4 4H5" />
							<polyline points="9 12 5 16 9 20" />
						</svg>
					</MarketingButton>
				</div>
			</AnimatedSection>
			<SiteFooter />
		</>
	);
}
