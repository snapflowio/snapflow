/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	OrganizationRolePermissionsEnum,
	OrganizationUserRoleEnum,
} from '@snapflow/api-client';
import {
	BookOpen,
	Box,
	Container,
	CreditCard,
	Database,
	Image,
	KeyRound,
	LogOut,
	PanelLeft,
	Settings,
	User,
	Users,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Logo } from '@/components/logo';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui';
import { Path } from '@/constants/paths';
import { useAuth } from '@/hooks/use-auth';
import { useSelectedOrganization } from '@/hooks/use-selected-organization';
import { cn } from '@/lib/utils';
import { DashboardOrgSwitcher } from './dashboard-org-switcher';

interface SidebarNavItemProps {
	icon: React.ElementType;
	label: string;
	href?: string;
	onClick?: () => void;
	isActive?: boolean;
}

function SidebarNavItem({
	icon: Icon,
	label,
	href,
	onClick,
	isActive,
}: SidebarNavItemProps) {
	const cls = cn(
		'group flex h-[30px] items-center gap-2 rounded-[8px] mx-[2px] px-2 font-season text-[14px] transition-colors',
		isActive
			? 'bg-(--surface-active) text-(--text-primary)'
			: 'text-(--text-body) hover:bg-(--surface-active)'
	);

	const inner = (
		<>
			<Icon className="h-4 w-4 shrink-0 text-text-icon" />
			<span className="truncate">{label}</span>
		</>
	);

	if (href) {
		return (
			<Link to={href} className={cls}>
				{inner}
			</Link>
		);
	}

	return (
		<button type="button" onClick={onClick} className={cn(cls, 'w-full')}>
			{inner}
		</button>
	);
}

interface DashboardSidebarProps {
	collapsed: boolean;
	onToggleCollapse: () => void;
}

export function DashboardSidebar({
	collapsed,
	onToggleCollapse,
}: DashboardSidebarProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const { user, signOut } = useAuth();

	const {
		selectedOrganization,
		authenticatedUserHasPermission,
		authenticatedUserOrganizationMember,
	} = useSelectedOrganization();

	const isOwner =
		authenticatedUserOrganizationMember?.role ===
		OrganizationUserRoleEnum.OWNER;

	const [showCollapsedContent, setShowCollapsedContent] = useState(collapsed);

	useLayoutEffect(() => {
		if (!collapsed) {
			document.documentElement.removeAttribute('data-sidebar-collapsed');
		}
	}, [collapsed]);

	useEffect(() => {
		if (collapsed) {
			document.documentElement.style.setProperty('--sidebar-width', '52px');
			const timer = setTimeout(() => setShowCollapsedContent(true), 200);
			return () => clearTimeout(timer);
		}
		document.documentElement.style.setProperty('--sidebar-width', '248px');
		setShowCollapsedContent(false);
	}, [collapsed]);

	const isActive = (href: string) => {
		if (href === Path.DASHBOARD) {
			return location.pathname === href;
		}

		return location.pathname.startsWith(href);
	};

	const handleLogout = async () => {
		await signOut();
		navigate(Path.LOGIN);
	};
	const initials = user?.name
		? user.name
				.split(' ')
				.map((n) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2)
		: 'U';

	return (
		<aside
			className="sidebar-container relative flex h-full shrink-0 flex-col overflow-hidden bg-surface-1"
			data-collapsed={collapsed || undefined}
			aria-label="Dashboard sidebar"
		>
			<div className="flex h-full flex-col pt-3">
				<div className="flex shrink-0 items-center pr-2 pb-2 pl-2.5">
					{showCollapsedContent ? (
						<button
							type="button"
							onClick={onToggleCollapse}
							className="group flex h-7.5 w-7.5 items-center justify-center rounded-lg hover:bg-surface-active"
							aria-label="Expand sidebar"
						>
							<Logo size={24} asLink={false} className="group-hover:hidden" />
							<PanelLeft className="hidden h-4 w-4 rotate-180 text-text-icon group-hover:block" />
						</button>
					) : (
						<Link
							to={Path.DASHBOARD}
							className="flex h-7.5 w-7.5 items-center justify-center rounded-lg hover:bg-surface-active"
						>
							<Logo size={24} asLink={false} />
						</Link>
					)}
					<button
						type="button"
						onClick={onToggleCollapse}
						className={cn(
							'sidebar-collapse-btn ml-auto flex h-7.5 items-center justify-center overflow-hidden rounded-lg transition-all duration-200 hover:bg-surface-active',
							collapsed ? 'w-0 opacity-0' : 'w-7.5 opacity-100'
						)}
						aria-label="Collapse sidebar"
					>
						<PanelLeft className="h-4 w-4 shrink-0 text-text-icon" />
					</button>
				</div>
				<div className="shrink-0 px-2.5">
					<DashboardOrgSwitcher collapsed={collapsed} />
				</div>
				<div className="mt-3.5 flex shrink-0 flex-col gap-0.5 px-2">
					<span className="sidebar-collapse-hide mx-0.5 pb-1 font-season text-[12px] text-text-icon">
						Workspace
					</span>
					<SidebarNavItem
						icon={Box}
						label="Sandboxes"
						href={Path.SANDBOXES}
						isActive={isActive(Path.SANDBOXES)}
					/>
					<SidebarNavItem
						icon={Image}
						label="Images"
						href={Path.IMAGES}
						isActive={isActive(Path.IMAGES)}
					/>
					<SidebarNavItem
						icon={Container}
						label="Registries"
						href={Path.REGISTRIES}
						isActive={isActive(Path.REGISTRIES)}
					/>
					{authenticatedUserHasPermission(
						OrganizationRolePermissionsEnum.READ_BUCKETS
					) && (
						<SidebarNavItem
							icon={Database}
							label="Buckets"
							href={Path.BUCKETS}
							isActive={isActive(Path.BUCKETS)}
						/>
					)}
					<SidebarNavItem
						icon={KeyRound}
						label="API Keys"
						href={Path.API_KEYS}
						isActive={isActive(Path.API_KEYS)}
					/>
					{!selectedOrganization?.personal && (
						<SidebarNavItem
							icon={Users}
							label="Members"
							href={Path.MEMBERS}
							isActive={isActive(Path.MEMBERS)}
						/>
					)}
					{isOwner && (
						<SidebarNavItem
							icon={CreditCard}
							label="Billing"
							href={Path.BILLING}
							isActive={isActive(Path.BILLING)}
						/>
					)}
				</div>
				<div className="flex-1" />
				<div className="shrink-0 border-border border-t px-2 pt-2 pb-2">
					<div className="flex flex-col gap-0.5">
						<a
							href="https://docs.snapflow.io"
							target="_blank"
							rel="noopener noreferrer"
							className={cn(
								'group mx-0.5 flex h-7.5 items-center gap-2 rounded-lg px-2 font-season text-[14px] transition-colors',
								'text-text-body hover:bg-surface-active'
							)}
						>
							<BookOpen className="h-4 w-4 shrink-0 text-text-icon" />
							<span className="truncate">Docs</span>
						</a>
						<SidebarNavItem
							icon={Settings}
							label="Settings"
							href={Path.SETTINGS}
							isActive={isActive(Path.SETTINGS)}
						/>
					</div>
					<div className="mt-2 border-border border-t pt-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild={true}>
								<button
									type="button"
									className="group mx-0.5 flex h-7.5 w-full items-center gap-2 rounded-lg px-2 font-season text-[14px] text-text-body transition-colors hover:bg-surface-active"
								>
									<div
										className="flex h-5 w-5 shrink-0 items-center justify-center rounded font-medium text-[10px] text-white leading-none"
										style={{ backgroundColor: 'var(--brand-tertiary-2)' }}
									>
										{initials}
									</div>
									<span className="min-w-0 flex-1 truncate text-left">
										{user?.name || user?.email || 'Account'}
									</span>
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side={collapsed ? 'right' : 'top'}
								sideOffset={collapsed ? 16 : 8}
								align="start"
								style={
									collapsed
										? { width: '200px' }
										: { width: 'var(--radix-dropdown-menu-trigger-width)' }
								}
							>
								{user && (
									<div className="flex items-center gap-2 px-2 py-1.5">
										<div
											className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-medium text-[12px] text-white"
											style={{ backgroundColor: 'var(--brand-tertiary-2)' }}
										>
											{initials}
										</div>
										<div className="flex min-w-0 flex-col">
											<span className="truncate font-medium text-[13px] text-text-primary">
												{user.name}
											</span>
											<span className="truncate text-[11px] text-text-tertiary">
												{user.email}
											</span>
										</div>
									</div>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => navigate(Path.ACCOUNT)}>
									<User className="mr-2 h-3.5 w-3.5 text-text-icon" />
									Account
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => navigate(Path.SETTINGS)}>
									<Settings className="mr-2 h-3.5 w-3.5 text-text-icon" />
									Settings
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleLogout}>
									<LogOut className="mr-2 h-3.5 w-3.5 text-text-icon" />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>
		</aside>
	);
}
