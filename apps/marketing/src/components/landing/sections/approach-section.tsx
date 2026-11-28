/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApproachStepper } from '@/components/landing/approach/approach-stepper';
import { GlobeHorizon } from '@/components/landing/visuals/globe-horizon/globe-horizon';
import { MachineField } from '@/components/landing/visuals/machine-field/machine-field';
import {
	AnimatedSection,
	SectionHeading,
} from '@/components/ui/marketing-primitives';
import {
	DENSE_SECTION_SPACE,
	PANEL,
	PANEL_CELL,
	SCENE_CELL,
	SECTION_SPACE,
	TEXT_GLOW,
} from '@/lib/marketing-styles';

export function NetworkIntroSection() {
	return (
		<AnimatedSection id="intro-platform" className={DENSE_SECTION_SPACE}>
			<div className={`${PANEL} ${SCENE_CELL}`}>
				<div className="pointer-events-none absolute inset-0">
					<MachineField />
				</div>
				<div className={`${PANEL_CELL} relative z-1 lg:pt-16`}>
					<div data-scene-heading className={TEXT_GLOW}>
						<SectionHeading
							eyebrow="The Snapflow marketplace"
							title={'Many machines.\nOne marketplace.'}
							body="Hosts list their machines and set their own prices. You compare them in one place and pick where each workload runs—or let the API place it within your limits."
							icon="intro"
						/>
					</div>
					<div className="h-72 min-[769px]:h-104" />
				</div>
			</div>
		</AnimatedSection>
	);
}

export function ApproachSection() {
	return (
		<AnimatedSection className={DENSE_SECTION_SPACE}>
			<div className={`${PANEL} grid lg:grid-cols-12`}>
				<div className={`${PANEL_CELL} flex items-center lg:col-span-5`}>
					<SectionHeading
						eyebrow="Your requirements"
						title="You choose what matters."
						body="Choose the resources, location, and how long it should run. Snapflow shows the machines that fit, each with one all-in hourly price, before you start."
						icon="offline"
						align="left"
					/>
				</div>
				<div
					className={`${SCENE_CELL} aspect-7/5 border-t min-[769px]:aspect-2/1 lg:col-span-7 lg:aspect-auto lg:min-h-112 lg:border-t-0 lg:border-l`}
				>
					<div className="pointer-events-none absolute inset-0">
						<GlobeHorizon />
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}

export function MachineOwnersSection() {
	return (
		<AnimatedSection id="our-approach" className={SECTION_SPACE}>
			<ApproachStepper>
				<SectionHeading
					eyebrow="For machine owners"
					title="Put your spare compute to work."
					body="Install Snapflow, choose how much of the machine to make available, set your price, and pause it whenever you need it back."
					icon="approach"
					align="left"
				/>
			</ApproachStepper>
		</AnimatedSection>
	);
}
