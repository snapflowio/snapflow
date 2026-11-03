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

const SIGN_IN_OTP_TYPE = 'sign-in';

type EmailOtpSignIn = Parameters<typeof authClient.signIn.emailOtp>[0];
type SocialSignIn = Parameters<typeof authClient.signIn.social>[0];

export async function sendSignInOtp(email: string): Promise<void> {
	unwrapAuthResult(
		await authClient.emailOtp.sendVerificationOtp({
			email,
			type: SIGN_IN_OTP_TYPE,
		})
	);
}

export async function signInWithEmailOtp(
	credentials: EmailOtpSignIn
): Promise<void> {
	unwrapAuthResult(await authClient.signIn.emailOtp(credentials));
}

export async function signInWithPasskey(): Promise<void> {
	unwrapAuthResult(await authClient.signIn.passkey());
}

export async function signInWithSocial(request: SocialSignIn): Promise<void> {
	unwrapAuthResult(await authClient.signIn.social(request));
}

export function isLastUsedLoginMethod(method: string): boolean {
	return authClient.isLastUsedLoginMethod(method);
}
