/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const ORGANIZATION_ERROR = {
	ORGANIZATION_NOT_FOUND: {
		code: 'ORGANIZATION_NOT_FOUND',
		message: 'Organization not found',
	},
	PERSONAL_ORGANIZATION_UNDELETABLE: {
		code: 'PERSONAL_ORGANIZATION_UNDELETABLE',
		message: 'A personal organization cannot be deleted',
	},
	PERSONAL_ORGANIZATION_UNSHARABLE: {
		code: 'PERSONAL_ORGANIZATION_UNSHARABLE',
		message: 'A personal organization cannot have other members',
	},
	PERSONAL_ORGANIZATION_UNLEAVABLE: {
		code: 'PERSONAL_ORGANIZATION_UNLEAVABLE',
		message: 'You cannot leave your personal organization',
	},
	PERSONAL_ORGANIZATION_ROLE_FIXED: {
		code: 'PERSONAL_ORGANIZATION_ROLE_FIXED',
		message: 'The owner of a personal organization cannot change roles',
	},
	ORGANIZATION_SLUG_RESERVED: {
		code: 'ORGANIZATION_SLUG_RESERVED',
		message: 'Organization slugs cannot start with a reserved prefix',
	},
	ORGANIZATION_SUSPENDED: {
		code: 'ORGANIZATION_SUSPENDED',
		message: 'The organization is suspended',
	},
	BASE_ROLE_REQUIRED: {
		code: 'ORGANIZATION_BASE_ROLE_REQUIRED',
		message: 'Assign exactly one of the owner, admin or member roles',
	},
	CONTEXT_CHANGED: {
		code: 'ORGANIZATION_CONTEXT_CHANGED',
		message:
			'You are no longer a member of the active organization; your personal organization is now active',
	},
} as const;
