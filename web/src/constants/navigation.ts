/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { LucideIcon } from 'lucide-react';
import {
	Box,
	Container,
	CreditCard,
	Database,
	Image,
	Key,
	LayoutDashboard,
	Settings,
	Users,
} from 'lucide-react';
import { Path } from '@/constants/paths';

export interface NavItem {
	name: string;
	href: string;
	icon: LucideIcon;
	matchPath?: string;
	items?: {
		name: string;
		href: string;
	}[];
}

export const getMainNavItems = (options: {
	showMembers?: boolean;
	showBuckets?: boolean;
	showBilling?: boolean;
}): NavItem[] => [
	{
		name: 'Dashboard',
		href: Path.DASHBOARD,
		icon: LayoutDashboard,
	},
	...(options.showMembers
		? [
				{
					name: 'Members',
					href: Path.MEMBERS,
					icon: Users,
				},
			]
		: []),
	{
		name: 'Sandboxes',
		href: Path.SANDBOXES,
		icon: Box,
	},
	{
		name: 'Images',
		href: Path.IMAGES,
		icon: Image,
	},
	{
		name: 'Registries',
		href: Path.REGISTRIES,
		icon: Container,
	},
	...(options.showBuckets
		? [
				{
					name: 'Buckets',
					href: Path.BUCKETS,
					icon: Database,
				},
			]
		: []),
	{
		name: 'API Keys',
		href: Path.API_KEYS,
		icon: Key,
	},
	...(options.showBilling
		? [
				{
					name: 'Billing',
					href: Path.BILLING,
					icon: CreditCard,
				},
			]
		: []),
	{
		name: 'Settings',
		href: Path.SETTINGS,
		icon: Settings,
	},
];

export const footerNavItems: NavItem[] = [];
