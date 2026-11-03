/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowMark } from '@/components/ui/brand-marks';
import { SITE_CONFIG } from '@/config/site';
import { Path } from '@/constants/paths';
import { CONTENT_WIDTH, MONO_FONT } from '@/lib/marketing-styles';

export function SiteFooter() {
	return (
		<footer className="relative z-10000 overflow-hidden border-snapflow-border border-t bg-snapflow-ink pt-16 pb-40 max-md:pt-12 max-md:pb-24">
			<div className={`${CONTENT_WIDTH} relative z-10`}>
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
					<div className="md:col-span-2 lg:col-span-1">
						<a href="/" className="inline-block">
							<img
								src="/assets/snapflow-logo.svg"
								alt="Snapflow"
								className="size-8"
							/>
						</a>
						<p className="mt-4 max-w-80 text-[.85rem] leading-[1.6] text-snapflow-paper/40">
							Run apps, jobs, and development environments on independently
							operated machines you choose.
						</p>
					</div>
					<div>
						<h3
							className={`${MONO_FONT} mb-5 text-[.75rem] uppercase tracking-[.15em] text-snapflow-paper/40`}
						>
							Explore
						</h3>
						<div className="space-y-[.6rem] pb-[.6rem] text-[.85rem] leading-[normal] text-snapflow-paper/50">
							<a
								className="block transition-colors duration-200 hover:text-snapflow-purple"
								href={Path.HOSTS}
							>
								Become a host
							</a>
							<a
								className="block transition-colors duration-200 hover:text-snapflow-purple"
								href={Path.DOCS}
								target="_blank"
								rel="noopener noreferrer"
							>
								Documentation
							</a>
							<a
								className="block transition-colors duration-200 hover:text-snapflow-purple"
								href={SITE_CONFIG.DISCORD_URL}
								target="_blank"
								rel="noopener noreferrer"
							>
								Join Discord
							</a>
						</div>
					</div>
					<div>
						<h3
							className={`${MONO_FONT} mb-5 text-[.75rem] uppercase tracking-[.15em] text-snapflow-paper/40`}
						>
							Legal
						</h3>
						<div className="space-y-[.6rem] pb-[.6rem] text-[.85rem] leading-[normal] text-snapflow-paper/50">
							<a
								className="block transition-colors duration-200 hover:text-snapflow-purple"
								href="/terms"
							>
								Terms of Service
							</a>
							<a
								className="block transition-colors duration-200 hover:text-snapflow-purple"
								href="/privacy"
							>
								Privacy Policy
							</a>
						</div>
					</div>
				</div>
				<div
					className={`${MONO_FONT} mt-16 flex flex-col items-start justify-between gap-4 border-snapflow-border border-t pt-8 text-[.75rem] uppercase tracking-widest text-snapflow-paper/35 md:flex-row md:items-center`}
				>
					<span>© 2026 Snapflow. All rights reserved.</span>
					<span className="flex items-center gap-[.6rem] text-snapflow-paper/50">
						<i className="size-1.5 animate-[snapflow-cursor_1.5s_steps(1)_infinite] bg-snapflow-purple" />
						All Systems Online
					</span>
				</div>
			</div>
			<SnapflowMark
				outline
				className="pointer-events-none absolute -right-15 -bottom-20 hidden w-150 text-snapflow-paper/6 opacity-[.03] md:block"
			/>
		</footer>
	);
}
