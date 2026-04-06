/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { GithubIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/logo';
import { Path } from '@/constants/paths';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { DocsDropdown } from './docs-dropdown';

type DropdownId = 'docs' | null;

interface NavLink {
	label: string;
	href: string;
	external?: boolean;
	icon?: 'chevron';
	dropdown?: 'docs';
}

const NAV_LINKS: NavLink[] = [
	{
		label: 'Docs',
		href: 'https://docs.snapflow.io',
		external: true,
		icon: 'chevron',
		dropdown: 'docs',
	},
	{ label: 'Pricing', href: '#pricing' },
];

const LOGO_CELL = 'flex items-center pl-[20px] lg:pl-[80px] pr-[20px]';
const LINK_CELL = 'flex items-center px-[14px]';

interface NavbarProps {
	logoOnly?: boolean;
}

export function Navbar({ logoOnly = false }: NavbarProps) {
	const [activeDropdown, setActiveDropdown] = useState<DropdownId>(null);
	const [hoveredLink, setHoveredLink] = useState<string | null>(null);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const openDropdown = useCallback((id: DropdownId) => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
		setActiveDropdown(id);
	}, []);

	const scheduleClose = useCallback(() => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
		}
		closeTimerRef.current = setTimeout(() => {
			setActiveDropdown(null);
			closeTimerRef.current = null;
		}, 100);
	}, []);

	useEffect(() => {
		return () => {
			if (closeTimerRef.current) {
				clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	const { user } = useAuth();
	const isLoggedIn = !!user;

	const anyHighlighted = activeDropdown !== null || hoveredLink !== null;

	useEffect(() => {
		document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
	}, [mobileMenuOpen]);

	useEffect(() => {
		const mq = window.matchMedia('(min-width: 1024px)');
		const handler = () => {
			if (mq.matches) {
				setMobileMenuOpen(false);
			}
		};
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}, []);

	return (
		<nav
			aria-label="Primary navigation"
			className="relative flex h-13 border-border border-b bg-bg font-[430] font-season text-[14px] text-text-primary"
			itemScope={true}
		>
			<Link
				to="/"
				className={LOGO_CELL}
				aria-label="Snapflow home"
				itemProp="url"
			>
				<span itemProp="name" className="sr-only">
					Snapflow
				</span>
				<Logo size={28} />
			</Link>

			{!logoOnly && (
				<>
					<ul className="mt-[0.75px] hidden lg:flex">
						{NAV_LINKS.map(({ label, href, external, icon, dropdown }) => {
							const hasDropdown = !!dropdown;
							const isActive = hasDropdown && activeDropdown === dropdown;
							const isThisHovered = hoveredLink === label;
							const isHighlighted = isActive || isThisHovered;
							const isDimmed = anyHighlighted && !isHighlighted;
							const linkClass = cn(
								icon ? `${LINK_CELL} gap-[8px]` : LINK_CELL,
								'transition-colors duration-200',
								isDimmed && 'text-text-primary/60'
							);
							const chevron = icon === 'chevron' && (
								<NavChevron open={isActive} />
							);

							if (hasDropdown) {
								return (
									<li
										key={label}
										className="relative flex"
										onMouseEnter={() => openDropdown(dropdown)}
										onMouseLeave={scheduleClose}
									>
										<button
											type="button"
											className={cn(linkClass, 'h-full cursor-pointer')}
											aria-expanded={isActive}
											aria-haspopup="true"
										>
											{label}
											{chevron}
										</button>

										<div
											className={cn(
												'absolute top-full left-0 z-50 -mt-0.5',
												isActive
													? 'pointer-events-auto opacity-100'
													: 'pointer-events-none opacity-0'
											)}
											style={{
												transform: isActive
													? 'translateY(0)'
													: 'translateY(-6px)',
												transition: 'opacity 200ms ease, transform 200ms ease',
											}}
										>
											{dropdown === 'docs' && <DocsDropdown />}
										</div>
									</li>
								);
							}

							return (
								<li
									key={label}
									className="flex"
									onMouseEnter={() => setHoveredLink(label)}
									onMouseLeave={() => setHoveredLink(null)}
								>
									{external ? (
										<a
											href={href}
											target="_blank"
											rel="noopener noreferrer"
											className={linkClass}
										>
											{label}
											{chevron}
										</a>
									) : (
										<Link to={href} className={linkClass} aria-label={label}>
											{label}
											{chevron}
										</Link>
									)}
								</li>
							);
						})}
						<li
							className={cn(
								'flex transition-opacity duration-200',
								anyHighlighted && hoveredLink !== 'github' && 'opacity-60'
							)}
							onMouseEnter={() => setHoveredLink('github')}
							onMouseLeave={() => setHoveredLink(null)}
						>
							<a
								href="https://github.com/snapflowio/snapflow"
								target="_blank"
								rel="noopener noreferrer"
								className={cn(LINK_CELL, 'gap-2')}
								aria-label="GitHub repository"
							>
								<GithubIcon className="h-3.5 w-3.5" />
								GitHub
							</a>
						</li>
					</ul>

					<div className="hidden flex-1 lg:block" />

					<div className="hidden items-center gap-2 pr-20 pl-5 lg:flex">
						{isLoggedIn ? (
							<Link
								to={Path.DASHBOARD}
								className="inline-flex h-7.5 items-center gap-1.75 rounded-[5px] border border-[#FFFFFF] bg-[#FFFFFF] px-2.25 text-[13.5px] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]"
								aria-label="Open Snapflow dashboard"
							>
								Open App
							</Link>
						) : (
							<>
								<Link
									to={Path.LOGIN}
									className="inline-flex h-7.5 items-center rounded-[5px] border border-border-1 px-2.25 text-[13.5px] text-text-primary transition-colors hover:bg-surface-active"
									aria-label="Log in"
								>
									Log in
								</Link>
								<Link
									to={Path.SIGNUP}
									className="inline-flex h-7.5 items-center gap-1.75 rounded-[5px] border border-[#FFFFFF] bg-[#FFFFFF] px-2.25 text-[13.5px] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]"
									aria-label="Get started with Snapflow"
								>
									Get started
								</Link>
							</>
						)}
					</div>

					{/* Mobile menu button */}
					<div className="flex flex-1 items-center justify-end pr-5 lg:hidden">
						<button
							type="button"
							className="flex h-8 w-8 items-center justify-center rounded-[5px] transition-colors hover:bg-surface-active"
							onClick={() => setMobileMenuOpen((prev) => !prev)}
							aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
							aria-expanded={mobileMenuOpen}
						>
							<MobileMenuIcon open={mobileMenuOpen} />
						</button>
					</div>

					{/* Mobile menu overlay */}
					<div
						className={cn(
							'fixed inset-x-0 top-13 bottom-0 z-50 flex flex-col overflow-y-auto bg-bg font-[430] font-season text-[14px] transition-all duration-200 lg:hidden',
							mobileMenuOpen ? 'visible opacity-100' : 'invisible opacity-0'
						)}
					>
						<ul className="flex flex-col">
							{NAV_LINKS.map(({ label, href, external }) => (
								<li key={label} className="border-border border-b">
									{external ? (
										<a
											href={href}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center justify-between px-5 py-3.5 text-text-primary transition-colors active:bg-surface-active"
											onClick={() => setMobileMenuOpen(false)}
										>
											{label}
											<ExternalArrowIcon />
										</a>
									) : (
										<Link
											to={href}
											className="flex items-center px-5 py-3.5 text-text-primary transition-colors active:bg-surface-active"
											onClick={() => setMobileMenuOpen(false)}
										>
											{label}
										</Link>
									)}
								</li>
							))}
							<li className="border-border border-b">
								<a
									href="https://github.com/snapflowio/snapflow"
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-2 px-5 py-3.5 text-text-primary transition-colors active:bg-surface-active"
									onClick={() => setMobileMenuOpen(false)}
								>
									<GithubIcon className="h-3.5 w-3.5" />
									GitHub
								</a>
							</li>
						</ul>

						<div className="mt-auto flex flex-col gap-2.5 p-5">
							{isLoggedIn ? (
								<Link
									to={Path.DASHBOARD}
									className="flex h-8 items-center justify-center rounded-[5px] border border-[#FFFFFF] bg-[#FFFFFF] text-[14px] text-black transition-colors active:bg-[#E0E0E0]"
									onClick={() => setMobileMenuOpen(false)}
								>
									Open App
								</Link>
							) : (
								<>
									<Link
										to={Path.LOGIN}
										className="flex h-8 items-center justify-center rounded-[5px] border border-border-1 text-[14px] text-text-primary transition-colors active:bg-surface-active"
										onClick={() => setMobileMenuOpen(false)}
									>
										Log in
									</Link>
									<Link
										to={Path.SIGNUP}
										className="flex h-8 items-center justify-center rounded-[5px] border border-[#FFFFFF] bg-[#FFFFFF] text-[14px] text-black transition-colors active:bg-[#E0E0E0]"
										onClick={() => setMobileMenuOpen(false)}
									>
										Get started
									</Link>
								</>
							)}
						</div>
					</div>
				</>
			)}
		</nav>
	);
}

function NavChevron({ open }: { open: boolean }) {
	return (
		<svg
			width="9"
			height="6"
			viewBox="0 0 10 6"
			fill="none"
			className="mt-[1.5px] shrink-0"
		>
			<line
				x1="1"
				y1="1"
				x2="5"
				y2="5"
				stroke="currentColor"
				strokeWidth="1.33"
				strokeLinecap="square"
				style={{
					transformOrigin: '3px 3px',
					transform: open ? 'rotate(-90deg)' : 'rotate(0deg)',
					transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
				}}
			/>
			<line
				x1="5"
				y1="5"
				x2="9"
				y2="1"
				stroke="currentColor"
				strokeWidth="1.33"
				strokeLinecap="square"
				style={{
					transformOrigin: '7px 3px',
					transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
					transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
				}}
			/>
		</svg>
	);
}

function MobileMenuIcon({ open }: { open: boolean }) {
	if (open) {
		return (
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
				<path
					d="M1 1L13 13M13 1L1 13"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
		);
	}
	return (
		<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
			<path
				d="M0 1H16M0 6H16M0 11H16"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function ExternalArrowIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			className="text-text-muted"
		>
			<path
				d="M3.5 2.5H9.5V8.5M9 3L3 9"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
