/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SECOND_FACTOR_VERIFIED_AT_FIELD } from '../better-auth/schema/additional-fields';

type SecondFactorSession = Record<string, unknown>;

function isSecondFactorVerified(session: SecondFactorSession): boolean {
	const verifiedAt = session[SECOND_FACTOR_VERIFIED_AT_FIELD];
	return verifiedAt !== null && verifiedAt !== undefined;
}

export async function hasVerifiedSecondFactor(input: {
	session: SecondFactorSession;
	twoFactorEnabled: unknown;
	countPasskeys: () => Promise<number>;
}): Promise<boolean> {
	if (!isSecondFactorVerified(input.session)) return false;
	if (input.twoFactorEnabled === true) return true;
	return (await input.countPasskeys()) > 0;
}
