/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Path } from '@/constants/paths';
import { AuthBackground } from '@/features/auth/components/auth-background';
import { Navbar } from '@/features/marketing/components/navbar/navbar';

interface AuthLayoutProps {
	children: ReactNode;
	termsText?: string;
}

export function AuthLayout({ children, termsText }: AuthLayoutProps) {
	return (
		<AuthBackground className="font-[430] font-season">
			<main className="relative flex min-h-full flex-col text-text-primary">
				<header className="shrink-0 bg-bg">
					<Navbar logoOnly={true} />
				</header>
				<div className="relative z-30 flex flex-1 items-center justify-center px-4 pb-24">
					<div className="w-full max-w-lg space-y-6 px-4">
						{children}
						{termsText && (
							<p className="text-center font-season text-[13px] text-text-icon">
								By {termsText}, you agree to our{' '}
								<Link
									to={Path.TERMS}
									className="text-text-secondary underline underline-offset-2 hover:text-text-primary"
								>
									Terms of Service
								</Link>{' '}
								and{' '}
								<Link
									to={Path.PRIVACY}
									className="text-text-secondary underline underline-offset-2 hover:text-text-primary"
								>
									Privacy Policy
								</Link>
							</p>
						)}
					</div>
				</div>
			</main>
		</AuthBackground>
	);
}
