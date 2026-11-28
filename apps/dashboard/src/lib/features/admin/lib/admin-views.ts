/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const ORGANIZATION_VIEWS = [
	{ value: 'organizations', label: 'Organizations' },
	{ value: 'limit-requests', label: 'Quota requests' },
] as const;

export const LISTING_VIEWS = [
	{ value: 'listings', label: 'Listings' },
	{ value: 'reviews', label: 'Reviews' },
] as const;

export const ABUSE_VIEWS = [
	{ value: 'reports', label: 'Reports' },
	{ value: 'cases', label: 'Cases' },
] as const;
