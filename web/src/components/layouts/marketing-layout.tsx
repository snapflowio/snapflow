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

interface MarketingLayoutProps {
	children: React.ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
	return (
		<div className="min-h-screen bg-bg">
			<header>
				<Navbar />
			</header>
			<main>{children}</main>
			<Footer />
		</div>
	);
}
