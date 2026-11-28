/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Passkey } from '@better-auth/passkey/client';
import { RecoveryOwnerKind, type UserWallet } from '@snapflow/api-client';
import { browserPasskeySigner, type PasskeySigner } from '@snapflow/sdk';
import { base64UrlToBytes } from '#lib/utils/base64url.ts';

const PUBLIC_KEY_CREDENTIAL_TYPE = 'public-key';

export function walletPasskey(
	wallet: UserWallet,
	passkeys: readonly Passkey[]
): Passkey | null {
	return passkeys.find((passkey) => passkey.id === wallet.passkeyId) ?? null;
}

export function signingPasskeys(
	wallet: UserWallet,
	passkeys: readonly Passkey[]
): readonly Passkey[] {
	const owner = walletPasskey(wallet, passkeys);
	if (owner) return [owner];
	return wallet.recoveryOwnerKind === RecoveryOwnerKind.Passkey ? passkeys : [];
}

export function passkeySigner(
	passkeys: readonly Passkey[],
	rpId: string
): PasskeySigner {
	return browserPasskeySigner({
		passkeyIds: new Map(
			passkeys.map((passkey) => [passkey.credentialID, passkey.id])
		),
		publicKey: {
			rpId,
			allowCredentials: passkeys.map((passkey) => ({
				type: PUBLIC_KEY_CREDENTIAL_TYPE,
				id: base64UrlToBytes(passkey.credentialID),
			})),
		},
	});
}
