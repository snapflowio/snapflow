/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const ENCRYPTION_ENCODING = 'base64';
export const ENCRYPTION_KEY_BYTES = 32;
export const ENCRYPTION_NONCE_BYTES = 12;
export const ENCRYPTION_AUTH_TAG_BYTES = 16;
export const ENCRYPTION_ENVELOPE_VERSION = 1;
export const ENCRYPTION_CONTEXT_SCHEMA_VERSION = 1;
export const ENCRYPTION_KEYRING_SCHEMA = 'snapflow.keyring.v1';
export const ENCRYPTION_KEYRING_MAXIMUM_BYTES = 64 * 1_024;
export const ENCRYPTION_KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export const ENCRYPTION_RECORD_KIND_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/;
export const ENCRYPTION_WRAP_DOMAIN = 'snapflow.envelope-data-key.v1';
export const DETERMINISTIC_HMAC_DOMAIN = 'snapflow.deterministic-hmac.v1';

export const ENCRYPTED_RECORD_KIND = {
	VOLUME_BACKUP_DATA_KEY: 'volume-backup-data-key',
	WORKLOAD_SECRET_VALUE: 'workload-secret-value',
	API_IDEMPOTENCY_RESPONSE: 'api-idempotency-response',
} as const;
