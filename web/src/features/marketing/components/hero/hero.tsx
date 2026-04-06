/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Link } from 'react-router';
import { Path } from '@/constants/paths';
import { GameOfLife } from './game-of-life';

const CTA_BASE =
	'inline-flex items-center h-[32px] rounded-[5px] border px-[10px] font-[430] font-season text-[14px]';

export function Hero() {
	return (
		<section
			id="hero"
			aria-labelledby="hero-heading"
			className="relative flex flex-col items-center overflow-hidden bg-bg pt-15 pb-3 lg:pt-25"
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-0"
			>
				<GameOfLife className="mask-[radial-gradient(ellipse_70%_60%_at_50%_40%,black_0%,transparent_70%)]" />
			</div>

			<div className="relative z-10 flex flex-col items-center gap-3">
				<h1
					id="hero-heading"
					className="font-[430] font-season text-[36px] text-white leading-[100%] tracking-[-0.02em] sm:text-[48px] lg:text-[72px]"
				>
					Smart Sandbox Environments
				</h1>
				<p className="font-[430] font-season text-[15px] text-text-primary/60 leading-[125%] tracking-[0.02em] lg:text-[18px]">
					Instant, ephemeral sandboxes for code execution and AI agents.
				</p>

				<div className="mt-3 flex items-center gap-2">
					<Link
						to={Path.SIGNUP}
						className={`${CTA_BASE} gap-2 border-[#FFFFFF] bg-[#FFFFFF] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]`}
						aria-label="Get started with Snapflow"
					>
						Get started
					</Link>
				</div>
			</div>

			<div className="relative z-10 mx-auto mt-[3.2vw] w-[78.9vw] px-[1.4vw]">
				<div className="relative z-10 overflow-hidden rounded border border-border">
					<div className="flex aspect-1116/549 w-full items-center justify-center bg-bg">
						<p className="font-season text-[#555] text-[16px]">
							Product preview coming soon
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
