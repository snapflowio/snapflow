/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { HostProfile, UpdateHostProfile } from '@snapflow/api-client';

export const HOST_PROFILE_LIMITS = {
	DISPLAY_NAME_MIN_LENGTH: 2,
	DISPLAY_NAME_MAX_LENGTH: 64,
	DESCRIPTION_MAX_LENGTH: 280,
} as const;

export type HostProfileValues = Record<keyof UpdateHostProfile, string>;

type HostProfileErrors = Partial<HostProfileValues>;

export function hostProfileValues(profile: HostProfile): HostProfileValues {
	return {
		displayName: profile.displayName,
		description: profile.description ?? '',
	};
}

export function hostProfileErrors(
	values: HostProfileValues
): HostProfileErrors {
	const {
		DISPLAY_NAME_MIN_LENGTH,
		DISPLAY_NAME_MAX_LENGTH,
		DESCRIPTION_MAX_LENGTH,
	} = HOST_PROFILE_LIMITS;
	const nameLength = values.displayName.trim().length;
	return {
		displayName:
			nameLength < DISPLAY_NAME_MIN_LENGTH ||
			nameLength > DISPLAY_NAME_MAX_LENGTH
				? `Use ${DISPLAY_NAME_MIN_LENGTH} to ${DISPLAY_NAME_MAX_LENGTH} characters.`
				: undefined,
		description:
			values.description.trim().length > DESCRIPTION_MAX_LENGTH
				? `Use at most ${DESCRIPTION_MAX_LENGTH} characters.`
				: undefined,
	};
}

export function toUpdateHostProfile(
	values: HostProfileValues
): UpdateHostProfile {
	const description = values.description.trim();
	return {
		displayName: values.displayName.trim(),
		description: description === '' ? null : description,
	};
}
