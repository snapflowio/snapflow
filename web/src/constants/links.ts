/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { GithubIcon, MailIcon, TwitterIcon } from 'lucide-react';
import { env } from '@/env';
import { Path } from './paths';
import { SITE_CONFIG } from './site';

export type AnchorLink = {
	label: string;
	href: string;
	external?: boolean;
	disabled?: boolean;
};
export type RouterLink = { label: string; to: string; disabled?: boolean };
export type FooterLink = AnchorLink | RouterLink;

export function isAnchorLink(link: FooterLink): link is AnchorLink {
	return 'href' in link;
}

export const productLinks: FooterLink[] = [
	{ label: 'Features', href: '/#features' },
	{ label: 'Pricing', href: '/#pricing' },
	{ label: 'Dashboard', to: Path.DASHBOARD },
];

export const resourceLinks: FooterLink[] = [
	{
		label: 'Enterprise',
		href: '/#enterprise',
		disabled: !env.VITE_SHOW_ENTERPRISE,
	},
	{ label: 'FAQ', href: '/#faq' },
	{ label: 'Discord', href: 'https://discord.gg/snapflow', external: true },
];

export const legalLinks: FooterLink[] = [
	{ label: 'Privacy', to: Path.PRIVACY },
	{ label: 'Terms', to: Path.TERMS },
];

export const socialLinks = [
	{ icon: MailIcon, href: SITE_CONFIG.SUPPORT_EMAIL, label: 'Email' },
	{
		icon: TwitterIcon,
		href: 'https://twitter.com/snapflow',
		label: 'Twitter',
		external: true,
	},
	{
		icon: GithubIcon,
		href: 'https://github.com/snapflow',
		label: 'GitHub',
		external: true,
	},
];

export const footerSections = [
	{
		title: 'Resources',
		links: resourceLinks,
		colSpan: 'col-span-1 md:col-span-2',
	},
	{
		title: 'Legal',
		links: legalLinks,
		colSpan: 'col-span-1 md:col-span-1',
	},
];
