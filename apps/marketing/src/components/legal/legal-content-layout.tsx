/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CONTENT_WIDTH, DISPLAY_FONT, MONO_FONT } from '@/lib/marketing-styles';

export const LEGAL_CONTENT_ID = 'legal-content';

interface LegalContentLayoutProps {
	title: string;
	lastUpdated?: string;
	children: React.ReactNode;
}

export function LegalContentLayout({
	title,
	lastUpdated,
	children,
}: LegalContentLayoutProps) {
	return (
		<div className="min-h-screen bg-snapflow-ink text-snapflow-paper">
			<main
				id={LEGAL_CONTENT_ID}
				className="mx-auto w-[min(calc(100%-3rem),960px)] py-16 max-md:w-[min(calc(100%-2rem),960px)] min-[769px]:py-32"
			>
				<h1
					className={`${DISPLAY_FONT} mb-12 text-[clamp(2.25rem,7vw,4.5rem)] leading-[1.05] tracking-[-.03em]`}
				>
					{title}
				</h1>
				{lastUpdated && (
					<p className="font-pixel mb-12 text-xs uppercase tracking-widest text-snapflow-paper-muted">
						Last updated on <time>{lastUpdated}</time>
					</p>
				)}
				<div className="max-w-180 space-y-8 text-[15px] leading-[1.7] text-snapflow-paper-dim [&_a]:text-snapflow-purple [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-snapflow-purple-hero [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-snapflow-purple [&_code]:bg-snapflow-surface [&_code]:px-1 [&_code]:font-mono [&_h2]:mt-12 [&_h2]:mb-6 [&_h2]:font-display [&_h2]:font-normal [&_h2]:text-[clamp(1.75rem,4vw,2.75rem)] [&_h2]:leading-[1.15] [&_h2]:text-snapflow-paper [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:font-display [&_h3]:font-normal [&_h3]:text-2xl [&_h3]:text-snapflow-paper [&_li]:text-snapflow-paper-dim [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-snapflow-paper [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
					{children}
				</div>
			</main>
			<footer className="border-snapflow-border border-t bg-snapflow-surface py-8">
				<div
					className={`${MONO_FONT} ${CONTENT_WIDTH} flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[.65rem] uppercase tracking-[.12em] text-snapflow-paper-muted`}
				>
					<span>© 2026 Snapflow. All rights reserved.</span>
					<span className="flex gap-6">
						<a
							href="/privacy"
							className="inline-flex min-h-11 items-center hover:text-snapflow-purple hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple"
						>
							Privacy
						</a>
						<a
							href="/terms"
							className="inline-flex min-h-11 items-center hover:text-snapflow-purple hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple"
						>
							Terms
						</a>
					</span>
				</div>
			</footer>
		</div>
	);
}
