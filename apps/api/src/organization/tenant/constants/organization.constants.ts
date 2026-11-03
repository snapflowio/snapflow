/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const SECONDS_PER_DAY = 86_400;
const INVITATION_LIFETIME_DAYS = 7;

export const ORGANIZATION_CREATION_LIMIT_PER_USER = 10;
export const ORGANIZATION_PENDING_INVITATION_LIMIT = 100;
export const ORGANIZATION_INVITATION_TTL_SECONDS =
	INVITATION_LIFETIME_DAYS * SECONDS_PER_DAY;

export const PERSONAL_ORGANIZATION_NAME = 'Personal';

export const ORGANIZATION_INVITATION_PATH = '/invitations';
