/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { authClient } from './client.ts';
import { unwrapAuthResult } from './result.ts';

export const TOTP_METHOD = 'totp';

type TwoFactorClient = typeof authClient.twoFactor;

export function enableTwoFactor(): ReturnType<TwoFactorClient['enable']> {
	return authClient.twoFactor.enable({ method: TOTP_METHOD });
}

export function disableTwoFactor(): ReturnType<TwoFactorClient['disable']> {
	return authClient.twoFactor.disable({});
}

export function generateBackupCodes(): ReturnType<
	TwoFactorClient['generateBackupCodes']
> {
	return authClient.twoFactor.generateBackupCodes({});
}

export function verifyTotp(
	code: string
): ReturnType<TwoFactorClient['verifyTotp']> {
	return authClient.twoFactor.verifyTotp({ code });
}

export async function verifyTotpStepUp(code: string): Promise<void> {
	unwrapAuthResult(await authClient.twoFactor.verifyTotp({ code }));
}

export async function verifyBackupCodeStepUp(code: string): Promise<void> {
	unwrapAuthResult(await authClient.twoFactor.verifyBackupCode({ code }));
}
