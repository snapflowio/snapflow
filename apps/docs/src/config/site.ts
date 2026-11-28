/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const DOCS_BASE = '/docs';

export const SITE = {
	NAME: 'Snapflow',
	TITLE: 'Snapflow Docs',
	DESCRIPTION:
		'Guides and API reference for running sandboxes on Snapflow and hosting machines on its marketplace.',
	REPOSITORY_URL: 'https://github.com/snapflowio/snapflow',
	EDIT_URL: 'https://github.com/snapflowio/snapflow/edit/main/apps/docs/',
	DISCORD_URL: 'https://discord.gg/eRTyxTkqPV',
	SUPPORT_EMAIL: 'support@snapflow.io',
	SOCIAL_IMAGE: '/assets/snapflow-social.png',
	THEME_COLOR: '#0a0a0a',
} as const;

export const Path = {
	HOME: '/',
	DOCS: `${DOCS_BASE}/`,
	DASHBOARD: '/dashboard',
	DASHBOARD_SIGNUP: '/dashboard/signup',
	PRIVACY: '/privacy',
	TERMS: '/terms',
} as const;

export type Path = (typeof Path)[keyof typeof Path];
