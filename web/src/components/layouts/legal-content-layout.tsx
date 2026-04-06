/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Footer } from '@/features/marketing/components/footer/footer';
import { Navbar } from '@/features/marketing/components/navbar/navbar';

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
		<main className="min-h-screen bg-bg font-[430] font-season text-text-primary">
			<header>
				<Navbar logoOnly={true} />
			</header>
			<div className="mx-auto max-w-200 px-6 pt-15 pb-20 sm:px-12">
				<h1 className="mb-12 text-center font-medium text-4xl text-text-primary md:text-5xl">
					{title}
				</h1>
				{lastUpdated && (
					<p className="mb-12 text-center text-[14px] text-text-icon">
						Last updated on <time>{lastUpdated}</time>
					</p>
				)}
				<div className="space-y-8 text-[15px] text-text-icon leading-[1.7] [&_a]:text-text-secondary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-text-primary [&_h2]:mt-12 [&_h2]:mb-6 [&_h2]:font-medium [&_h2]:text-[22px] [&_h2]:text-text-primary [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:font-medium [&_h3]:text-[18px] [&_h3]:text-text-primary [&_li]:text-text-icon [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-text-primary [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
					{children}
				</div>
			</div>
			<Footer />
		</main>
	);
}
