/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { generateKeyPair } from 'node:crypto';
import { promisify } from 'node:util';
import type { UserSSHKeyPair } from '../entities/user.entity';

const SSH_KEY_TYPE = 'ssh-rsa';
const SSH_KEY_MODULUS_LENGTH = 4096;
const SSH_KEY_COMMENT = 'snapflow';
const SSH_STRING_LENGTH_BYTES = 4;
const MPINT_SIGN_BIT = 0x80;
const MPINT_PADDING = Buffer.of(0);

const generateKeyPairAsync = promisify(generateKeyPair);

function sshString(value: Buffer): Buffer {
	const length = Buffer.alloc(SSH_STRING_LENGTH_BYTES);
	length.writeUInt32BE(value.length);
	return Buffer.concat([length, value]);
}

function sshMpint(base64url: string): Buffer {
	const magnitude = Buffer.from(base64url, 'base64url');
	const [leadingByte = 0] = magnitude;
	return sshString(
		leadingByte & MPINT_SIGN_BIT
			? Buffer.concat([MPINT_PADDING, magnitude])
			: magnitude
	);
}

export async function generateSshKeyPair(): Promise<UserSSHKeyPair> {
	const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
		modulusLength: SSH_KEY_MODULUS_LENGTH,
	});
	const { e, n } = publicKey.export({ format: 'jwk' });
	if (!e || !n) {
		throw new Error(
			'Generated RSA public key is missing its exponent or modulus'
		);
	}
	const blob = Buffer.concat([
		sshString(Buffer.from(SSH_KEY_TYPE)),
		sshMpint(e),
		sshMpint(n),
	]);
	return {
		publicKey: `${SSH_KEY_TYPE} ${blob.toString('base64')} ${SSH_KEY_COMMENT}`,
		privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
	};
}
