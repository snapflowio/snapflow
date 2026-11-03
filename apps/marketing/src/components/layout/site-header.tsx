/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useState } from 'react';
import { Path } from '@/constants/paths';
import { CONTENT_WIDTH, MONO_FONT } from '@/lib/marketing-styles';

export function SiteHeader({
	variant = 'hero',
}: {
	variant?: 'hero' | 'default';
}) {
	const [open, setOpen] = useState(false);
	const hero = variant === 'hero';
	return (
		<header
			className={`relative z-20 flex ${hero ? 'bg-snapflow-purple-hero text-snapflow-ink' : 'bg-snapflow-ink text-snapflow-paper'}`}
		>
			<nav
				className={`${CONTENT_WIDTH} relative flex items-center justify-between py-6 max-md:py-4`}
				aria-label="Main navigation"
			>
				<a href="/" className="flex items-center" aria-label="Snapflow home">
					<img
						src="/assets/snapflow-logo.svg"
						alt=""
						className={`size-8 ${hero ? 'brightness-0' : ''}`}
					/>
				</a>
				<button
					type="button"
					className="relative z-10002 hidden flex-col items-center justify-center gap-1.25 p-2 max-md:flex"
					aria-expanded={open}
					aria-controls="site-nav-menu"
					aria-label="Toggle navigation"
					onClick={() => setOpen((value) => !value)}
				>
					<span
						className={`h-0.5 w-6 origin-center bg-current transition ${open ? 'translate-y-1.75 rotate-45 bg-snapflow-paper' : ''}`}
					/>
					<span
						className={`h-0.5 w-6 bg-current transition ${open ? 'opacity-0' : ''}`}
					/>
					<span
						className={`h-0.5 w-6 origin-center bg-current transition ${open ? '-translate-y-1.75 -rotate-45 bg-snapflow-paper' : ''}`}
					/>
				</button>
				<ul
					id="site-nav-menu"
					className={`${open ? 'max-md:visible max-md:opacity-100' : 'max-md:invisible max-md:opacity-0'} flex list-none items-center gap-8 p-0 transition-[opacity,visibility] duration-300 max-md:fixed max-md:inset-0 max-md:z-10001 max-md:flex-col max-md:justify-center max-md:gap-10 max-md:bg-snapflow-ink max-md:p-8`}
				>
					<li>
						<a
							href="/blog"
							onClick={() => setOpen(false)}
							className={`${MONO_FONT} text-xs font-bold tracking-wider opacity-70 transition-opacity hover:opacity-100 max-md:text-xl max-md:text-snapflow-paper max-md:opacity-100`}
						>
							Blog
						</a>
					</li>
					<li>
						<a
							href={Path.DASHBOARD}
							onClick={() => setOpen(false)}
							className={`${MONO_FONT} inline-flex h-5.5 items-center p-[1.2rem] text-xs font-bold tracking-wider [clip-path:polygon(12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%,0_12px)] ${hero ? 'bg-snapflow-ink text-snapflow-paper max-md:bg-snapflow-purple-hero' : 'bg-snapflow-purple text-snapflow-ink max-md:bg-snapflow-purple'} max-md:text-xl max-md:text-snapflow-ink`}
						>
							Open App
						</a>
					</li>
				</ul>
			</nav>
		</header>
	);
}
