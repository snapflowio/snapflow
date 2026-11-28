/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ENCRYPTION_WRAP_DOMAIN } from '../constants/encryption.constants';
import {
	type EncryptionContext,
	encryptionContextSchema,
} from '../schemas/encryption.schema';

export function encryptionContextBytes(context: EncryptionContext): Buffer {
	const value = encryptionContextSchema.parse(context);
	return Buffer.from(
		JSON.stringify([
			value.schemaVersion,
			value.recordKind,
			value.organizationId,
			value.recordId,
			value.recordVersion,
		]),
		'utf8'
	);
}

export function wrappedKeyContextBytes(context: EncryptionContext): Buffer {
	return Buffer.concat([
		Buffer.from(ENCRYPTION_WRAP_DOMAIN, 'utf8'),
		Buffer.from([0]),
		encryptionContextBytes(context),
	]);
}
