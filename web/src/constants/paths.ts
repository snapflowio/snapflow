/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum Path {
	HOME = '/',
	LANDING = '/',
	PRICING = '/pricing',
	PRIVACY = '/privacy',
	TERMS = '/terms',
	LOGIN = '/login',
	SIGNUP = '/signup',
	AUTHORIZE = '/auth/authorize',
	DASHBOARD = '/dashboard',
	CALLBACK = '/callback',
	NOT_FOUND = 'not-found',
	API_KEYS = '/dashboard/keys',
	SANDBOXES = '/dashboard/sandboxes',
	IMAGES = '/dashboard/images',
	REGISTRIES = '/dashboard/registries',
	BUCKETS = '/dashboard/buckets',
	BILLING = '/dashboard/billing',
	MEMBERS = '/dashboard/members',
	ROLES = '/dashboard/roles',
	SETTINGS = '/dashboard/settings',
}

export const getRouteSubPath = (path: Path): string => {
	return path.replace('/dashboard/', '');
};
