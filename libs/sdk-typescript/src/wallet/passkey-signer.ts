/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	encodeWebAuthnSignature,
	type WebAuthnAssertion,
} from '@snapflow/contracts';
import { bytesToHex, type Hash, type Hex, hexToBytes } from 'viem';
import { SnapflowWalletError } from '../errors/wallet-error.js';

export interface PasskeySigner {
	passkeyId?: string;
	sign(challenge: Hash): Promise<PasskeyAssertion>;
}

export interface PasskeyAssertion extends WebAuthnAssertion {
	passkeyId?: string;
}

export interface PasskeySignature {
	signature: Hex;
	passkeyId?: string;
}

export type PasskeyRequestOptions = Omit<
	PublicKeyCredentialRequestOptions,
	'challenge' | 'userVerification'
>;

export interface BrowserPasskeySignerOptions {
	passkeyId?: string;
	passkeyIds?: ReadonlyMap<string, string>;
	publicKey?: PasskeyRequestOptions;
	signal?: AbortSignal;
	credentials?: CredentialsContainer;
}

const USER_VERIFICATION: UserVerificationRequirement = 'required';
const PUBLIC_KEY_CREDENTIAL_TYPE = 'public-key';

function isPublicKeyCredential(
	credential: Credential | null
): credential is PublicKeyCredential {
	return credential?.type === PUBLIC_KEY_CREDENTIAL_TYPE;
}

function isAssertionResponse(
	response: AuthenticatorResponse
): response is AuthenticatorAssertionResponse {
	return 'authenticatorData' in response && 'signature' in response;
}

export function webAuthnAssertionOf(
	credential: Credential | null
): WebAuthnAssertion {
	if (!isPublicKeyCredential(credential)) {
		throw new SnapflowWalletError('The passkey prompt returned no credential');
	}
	const { response } = credential;
	if (!isAssertionResponse(response)) {
		throw new SnapflowWalletError(
			'The passkey prompt returned no assertion response'
		);
	}
	return {
		authenticatorData: bytesToHex(new Uint8Array(response.authenticatorData)),
		clientDataJSON: new TextDecoder().decode(response.clientDataJSON),
		signature: bytesToHex(new Uint8Array(response.signature)),
	};
}

export function browserPasskeySigner(
	options: BrowserPasskeySignerOptions = {}
): PasskeySigner {
	return {
		passkeyId: options.passkeyId,
		async sign(challenge) {
			const credentials =
				options.credentials ?? globalThis.navigator?.credentials;
			if (!credentials) {
				throw new SnapflowWalletError(
					'WebAuthn is not available in this runtime; pass a PasskeySigner'
				);
			}
			const credential = await credentials.get({
				publicKey: {
					...options.publicKey,
					challenge: new Uint8Array(hexToBytes(challenge)),
					userVerification: USER_VERIFICATION,
				},
				signal: options.signal,
			});
			return {
				...webAuthnAssertionOf(credential),
				passkeyId:
					(credential && options.passkeyIds?.get(credential.id)) ??
					options.passkeyId,
			};
		},
	};
}

export async function passkeySignature(
	signer: PasskeySigner,
	safeTxHash: Hash
): Promise<Hex> {
	return (await signWithPasskey(signer, safeTxHash)).signature;
}

export async function signWithPasskey(
	signer: PasskeySigner,
	safeTxHash: Hash
): Promise<PasskeySignature> {
	try {
		const assertion = await signer.sign(safeTxHash);
		return {
			signature: encodeWebAuthnSignature(assertion),
			passkeyId: assertion.passkeyId ?? signer.passkeyId,
		};
	} catch (error) {
		if (error instanceof SnapflowWalletError) throw error;
		throw new SnapflowWalletError(
			`The passkey did not sign: ${error instanceof Error ? error.message : String(error)}`,
			undefined,
			error
		);
	}
}
