/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const ORGANIZATION_CONTEXT_CHANGED_CODE = 'ORGANIZATION_CONTEXT_CHANGED';

let activeOrganizationId: string | null = null;

export function activeOrganizationContext(): string | null {
	return activeOrganizationId;
}

export function setActiveOrganizationContext(
	organizationId: string | null
): void {
	activeOrganizationId = organizationId;
}

export function isOrganizationContextChanged(error: unknown): boolean {
	return (
		SnapflowError.fromUnknown(error).code === ORGANIZATION_CONTEXT_CHANGED_CODE
	);
}
