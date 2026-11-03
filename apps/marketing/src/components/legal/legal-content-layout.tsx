/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Path } from '@/constants/paths';
import { CONTENT_WIDTH, DISPLAY_FONT, MONO_FONT } from '@/lib/marketing-styles';

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
			<a
				href="#legal-content"
				className={`${MONO_FONT} fixed top-3 left-3 z-60 -translate-y-20 bg-snapflow-purple px-4 py-3 text-xs font-bold text-snapflow-ink transition-transform focus:translate-y-0`}
			>
				Skip to content
			</a>
			<header className="border-snapflow-border border-b">
				<nav className="mx-auto flex w-full max-w-324 items-center justify-between px-12 py-6 max-md:px-5">
					<a href="/" aria-label="Snapflow — Home">
						<img src="/assets/snapflow-logo.svg" alt="" className="size-8" />
					</a>
					<a
						href={Path.DASHBOARD_LOGIN}
						className={`${MONO_FONT} bg-snapflow-purple px-5 py-3 text-xs font-bold text-snapflow-ink [clip-path:polygon(12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%,0_12px)]`}
					>
						Open Dashboard
					</a>
				</nav>
			</header>
			<main
				id="legal-content"
				className="mx-auto w-[min(calc(100%-3rem),960px)] py-16 max-md:w-[min(calc(100%-2rem),960px)] max-md:py-12"
			>
				<h1
					className={`${DISPLAY_FONT} mb-12 text-[clamp(2.25rem,7vw,4.5rem)] leading-[1.05] tracking-[-.03em]`}
				>
					{title}
				</h1>
				{lastUpdated && (
					<p
						className={`${MONO_FONT} mb-12 text-xs uppercase tracking-widest text-snapflow-paper/50`}
					>
						Last updated on <time>{lastUpdated}</time>
					</p>
				)}
				<div className="max-w-180 space-y-8 text-[15px] leading-[1.7] text-snapflow-paper-dim [&_a]:text-snapflow-paper [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-snapflow-purple [&_h2]:mt-12 [&_h2]:mb-6 [&_h2]:font-['Chalet',sans-serif] [&_h2]:font-bold [&_h2]:text-[clamp(1.75rem,4vw,2.75rem)] [&_h2]:leading-[1.15] [&_h2]:text-snapflow-paper [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:font-['Chalet',sans-serif] [&_h3]:font-bold [&_h3]:text-xl [&_h3]:text-snapflow-paper [&_li]:text-snapflow-paper-dim [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-snapflow-paper [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
					{children}
				</div>
			</main>
			<footer className="border-snapflow-border border-t py-10">
				<div
					className={`${MONO_FONT} ${CONTENT_WIDTH} flex flex-wrap justify-between gap-4 text-[.65rem] uppercase tracking-[.12em] text-snapflow-paper/40`}
				>
					<span>© 2026 Snapflow. All rights reserved.</span>
					<a href="/privacy" className="hover:text-snapflow-purple">
						Privacy
					</a>
					<a href="/terms" className="hover:text-snapflow-purple">
						Terms
					</a>
				</div>
			</footer>
		</div>
	);
}
