/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { FaqSection } from '@/components/landing/sections/faq-section';
import { RiverBackground } from '@/components/landing/visuals/river/river-background';
import { SiteFooter } from '@/components/layout/site-footer';
import {
	AnimatedSection,
	MarketingButton,
} from '@/components/ui/marketing-primitives';
import { Path } from '@/constants/paths';
import { CONTENT_WIDTH, DISPLAY_FONT, TEXT_GLOW } from '@/lib/marketing-styles';

const WATERFALL_FOOT_SELECTOR = '[data-snapflow-waterfall-foot]';

export function ClosingSection() {
	return (
		<>
			<FaqSection />
			<AnimatedSection className="relative z-10000 isolate overflow-hidden bg-snapflow-ink pt-56 pb-44 text-center min-[769px]:pt-72 min-[769px]:pb-56">
				<RiverBackground waterfallFootSelector={WATERFALL_FOOT_SELECTOR} />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-40 bg-linear-to-b from-transparent to-snapflow-ink" />
				<div
					className={`${CONTENT_WIDTH} relative z-10 flex flex-col items-center px-5 md:px-0`}
				>
					<div data-snapflow-waterfall-foot className="h-0 w-full" />
					<div className="relative isolate mx-auto mt-12 w-fit">
						<div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[150%] w-[140%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,var(--snapflow-ink)_35%,transparent_70%)] opacity-85 blur-xl" />
						<h2
							className={`${DISPLAY_FONT} ${TEXT_GLOW} mx-auto mt-8 max-w-300 text-[clamp(2.5rem,8vw,7rem)] leading-[.9] tracking-[-.03em] min-[769px]:text-[clamp(4rem,8vw,7rem)]`}
						>
							Bring your app.
							<br />
							Let it flow.
						</h2>
						<p
							className={`${TEXT_GLOW} mx-auto mt-8 max-w-135 text-[1.15rem] font-semibold leading-[1.6] text-snapflow-paper-dim max-md:text-base`}
						>
							Many independent machines, one place to deploy. Pick one yourself
							or let the API place it within your limits.
						</p>
					</div>
					<MarketingButton
						href={Path.DASHBOARD_SIGNUP}
						className="mt-12 w-full max-w-125 gap-3 py-8 text-[1.3rem] shadow-[0_0_40px_color-mix(in_srgb,var(--snapflow-purple)_40%,transparent)] max-md:py-5 max-md:text-base"
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
