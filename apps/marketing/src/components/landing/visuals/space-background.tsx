/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const SPACE_ASSET_ROOT = '/assets/space';

export function SpaceBackground() {
	return (
		<div
			className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[128%] overflow-hidden bg-snapflow-space [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,var(--snapflow-ink)_38%,var(--snapflow-ink)_100%)] mask-[linear-gradient(to_bottom,transparent_0%,var(--snapflow-ink)_38%,var(--snapflow-ink)_100%)]"
			aria-hidden="true"
		>
			<div className="absolute inset-[-18%] isolate overflow-hidden bg-snapflow-space">
				<img
					src={`${SPACE_ASSET_ROOT}/arcjet-stars-1.jpg`}
					alt=""
					loading="lazy"
					decoding="async"
					className="absolute top-1/2 left-1/2 h-[122%] w-[122%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover opacity-35 will-change-[scale,rotate] motion-safe:animate-[snapflow-space-stars_285s_linear_infinite]"
				/>
				<img
					src={`${SPACE_ASSET_ROOT}/arcjet-space-rocks.jpg`}
					alt=""
					loading="lazy"
					decoding="async"
					className="absolute top-1/2 left-1/2 h-[132%] w-[132%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover opacity-40 mix-blend-screen will-change-[scale,rotate] motion-safe:animate-[snapflow-space-rocks_56s_cubic-bezier(.2,0,.8,1)_infinite_alternate]"
				/>
				<img
					src={`${SPACE_ASSET_ROOT}/arcjet-space-clouds-1.jpg`}
					alt=""
					loading="lazy"
					decoding="async"
					className="absolute top-1/2 left-1/2 h-[116%] w-[116%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover opacity-20 mix-blend-screen will-change-[scale,rotate] motion-safe:animate-[snapflow-space-clouds_232s_linear_infinite]"
				/>
				<img
					src={`${SPACE_ASSET_ROOT}/arcjet-space-clouds-2.jpg`}
					alt=""
					loading="lazy"
					decoding="async"
					className="absolute top-1/2 left-1/2 h-[118%] w-[118%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover opacity-[.14] mix-blend-screen will-change-[scale,rotate] motion-safe:animate-[snapflow-space-clouds-secondary_382s_linear_infinite]"
				/>

				<div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,var(--snapflow-space-deep)_0%,var(--snapflow-space-purple)_42%,var(--snapflow-space-violet)_68%,var(--snapflow-ink)_100%)] opacity-75 mix-blend-hard-light" />
				<div className="absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_50%_48%,color-mix(in_srgb,var(--snapflow-purple)_20%,transparent)_0%,transparent_36%,color-mix(in_srgb,var(--snapflow-ink)_45%,transparent)_68%,var(--snapflow-ink)_100%)]" />
				<div className="absolute inset-0 z-30 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--snapflow-ink)_8%,transparent)_42%,color-mix(in_srgb,var(--snapflow-ink)_70%,transparent)_84%,var(--snapflow-ink)_100%)]" />
				<div className="absolute inset-0 z-40 bg-[repeating-linear-gradient(180deg,color-mix(in_srgb,var(--snapflow-paper)_45%,transparent)_0,color-mix(in_srgb,var(--snapflow-paper)_45%,transparent)_2.5px,transparent_2.5px,transparent_5px)] opacity-[.09] mix-blend-overlay" />
				<div className="absolute inset-0 z-50 bg-[url('/assets/space/arcjet-noise.png')] bg-size-[128px_128px] opacity-[.08] mix-blend-plus-lighter" />
			</div>
		</div>
	);
}
