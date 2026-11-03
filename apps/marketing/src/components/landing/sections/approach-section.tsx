/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApproachStepper } from '@/components/landing/approach/approach-stepper';
import { PlacementFlowDiagram } from '@/components/landing/approach/placement-flow-diagram';
import { PlacementGraphic } from '@/components/landing/approach/placement-graphic';
import { BandShader } from '@/components/landing/visuals/band-shader';
import {
	AnimatedSection,
	Badge,
	SectionHeading,
} from '@/components/ui/marketing-primitives';
import {
	CONTENT_WIDTH,
	DISPLAY_FONT,
	SECTION_DIVIDER,
	TEXT_GLOW,
} from '@/lib/marketing-styles';

export function NetworkIntroSection() {
	return (
		<AnimatedSection
			id="intro-platform"
			className="relative overflow-hidden py-16 min-[769px]:py-32"
		>
			<BandShader
				anchorSelector="[data-snapflow-shader-anchor='intro']"
				anchorPadding={50}
				className="-translate-y-35"
			/>
			<div
				className={`${CONTENT_WIDTH} relative z-1 flex flex-col items-center max-[768px]:px-5`}
			>
				<div data-snapflow-shader-anchor="intro" className={TEXT_GLOW}>
					<SectionHeading
						eyebrow="The Snapflow marketplace"
						title={'Many machines.\nOne marketplace.'}
						body="Hosts list their machines and set their own prices. You compare them in one place and pick where each workload runs—or let the API place it within your limits."
						icon="intro"
						size="large"
					/>
				</div>
				<div className="h-20" />
				<PlacementFlowDiagram />
			</div>
		</AnimatedSection>
	);
}

export function ApproachSection() {
	return (
		<>
			<AnimatedSection className="relative overflow-hidden">
				<div
					className={`${CONTENT_WIDTH} grid items-center gap-8 min-[769px]:grid-cols-2 min-[769px]:gap-16`}
				>
					<div className="relative flex min-h-75 items-center justify-center overflow-hidden border-snapflow-border border-b min-[769px]:min-h-105 min-[769px]:border-r min-[769px]:border-b-0">
						<div className="size-70 min-[769px]:size-95">
							<PlacementGraphic />
						</div>
					</div>
					<div className="text-center min-[769px]:text-left">
						<Badge icon="offline" className="mr-0 ml-0">
							Your requirements
						</Badge>
						<h2
							className={`${DISPLAY_FONT} mt-6 text-[clamp(2.5rem,5vw,3.5rem)] leading-[.9] tracking-[-.03em]`}
						>
							You choose what matters.
						</h2>
						<p className="mt-6 mb-10 max-w-110 text-base leading-[1.7] text-snapflow-paper-dim max-md:mx-auto">
							Choose the resources, location, and how long it should run.
							Snapflow shows the machines that fit, each with one all-in hourly
							price, before you start.
						</p>
					</div>
				</div>
			</AnimatedSection>
			<div className={SECTION_DIVIDER} />
			<AnimatedSection id="our-approach" className="pt-16 min-[769px]:pt-32">
				<div className={`${CONTENT_WIDTH} px-0 max-[768px]:px-5`}>
					<div className="mb-4 px-12">
						<SectionHeading
							eyebrow="For machine owners"
							title="Put your spare compute to work."
							body="Install Snapflow, choose how much of the machine to make available, set your price, and pause it whenever you need it back."
							icon="approach"
						/>
					</div>
					<ApproachStepper />
				</div>
			</AnimatedSection>
		</>
	);
}
