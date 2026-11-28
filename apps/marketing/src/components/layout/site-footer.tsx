/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowMark } from '@/components/ui/brand-marks';
import { ANALYTICS } from '@/config/analytics';
import { SITE_CONFIG } from '@/config/site';
import { Path } from '@/constants/paths';
import { CONTENT_WIDTH, MONO_FONT } from '@/lib/marketing-styles';

const FOOTER_LINK = 'flex min-h-11 w-fit items-center md:block md:min-h-0';

export function SiteFooter() {
	return (
		<footer className="relative z-10000 overflow-hidden border-snapflow-border border-t bg-snapflow-ink pt-16 pb-40 max-md:pt-12 max-md:pb-24">
			<div className={`${CONTENT_WIDTH} relative z-10`}>
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
					<div className="md:col-span-2 lg:col-span-1">
						<a
							href="/"
							className="-m-1.5 inline-flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple"
							aria-label="Snapflow"
						>
							<img src="/assets/snapflow-logo.svg" alt="" className="size-8" />
						</a>
						<p className="mt-4 max-w-80 text-[.85rem] leading-[1.6] text-snapflow-paper/40">
							Run apps, jobs, and development environments on independently
							operated machines you choose.
						</p>
					</div>
					<div>
						<h3
							className={`${MONO_FONT} mb-2 text-[.75rem] uppercase tracking-[.15em] text-snapflow-paper/40 md:mb-5`}
						>
							Explore
						</h3>
						<div className="md:space-y-[.6rem] md:pb-[.6rem] text-[.85rem] leading-[normal] text-snapflow-paper/50">
							<a
								className={`${FOOTER_LINK} transition-colors duration-200 hover:text-snapflow-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple`}
								href={Path.HOSTS}
							>
								Become a host
							</a>
							<a
								className={`${FOOTER_LINK} transition-colors duration-200 hover:text-snapflow-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple`}
								href={Path.DOCS}
								target="_blank"
								rel="noopener noreferrer"
							>
								Documentation
							</a>
							<a
								className={`${FOOTER_LINK} transition-colors duration-200 hover:text-snapflow-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple`}
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
							className={`${MONO_FONT} mb-2 text-[.75rem] uppercase tracking-[.15em] text-snapflow-paper/40 md:mb-5`}
						>
							Legal
						</h3>
						<div className="md:space-y-[.6rem] md:pb-[.6rem] text-[.85rem] leading-[normal] text-snapflow-paper/50">
							<a
								className={`${FOOTER_LINK} transition-colors duration-200 hover:text-snapflow-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple`}
								href="/terms"
							>
								Terms of Service
							</a>
							<a
								className={`${FOOTER_LINK} transition-colors duration-200 hover:text-snapflow-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple`}
								href="/privacy"
							>
								Privacy Policy
							</a>
							<a
								className={`${FOOTER_LINK} transition-colors duration-200 hover:text-snapflow-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple`}
								href={Path.ABUSE}
							>
								Report Abuse
							</a>
							{ANALYTICS && (
								<button
									type="button"
									data-consent-settings
									className={`${FOOTER_LINK} cursor-pointer text-left transition-colors duration-200 hover:text-snapflow-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple`}
								>
									Cookie settings
								</button>
							)}
						</div>
					</div>
				</div>
				<div
					className={`${MONO_FONT} mt-16 flex flex-col items-start justify-between gap-4 border-snapflow-border border-t pt-8 text-[.75rem] uppercase tracking-widest text-snapflow-paper/35 md:flex-row md:items-center`}
				>
					<span>© 2026 Snapflow. All rights reserved.</span>
				</div>
			</div>
			<SnapflowMark
				outline
				className="pointer-events-none absolute -right-15 -bottom-20 hidden w-150 text-snapflow-purple opacity-[.03] md:block"
			/>
		</footer>
	);
}
