/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { API_KEY_HEADER, API_KEY_PREFIX } from '../constants/api-key.constants';

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;
const AUTHORIZATION_HEADER = 'authorization';

export interface CredentialHeaders {
	apiKeyHeader: string | null;
	bearer: string | null;
}

export function readCredentialHeaders(headers: Headers): CredentialHeaders {
	return {
		apiKeyHeader: headers.get(API_KEY_HEADER)?.trim() || null,
		bearer:
			headers.get(AUTHORIZATION_HEADER)?.match(BEARER_PATTERN)?.[1]?.trim() ||
			null,
	};
}

export function isApiKeyToken(token: string): boolean {
	return token.startsWith(API_KEY_PREFIX);
}

export function apiKeyFromHeaders(headers: Headers): string | null {
	const { apiKeyHeader, bearer } = readCredentialHeaders(headers);
	if (apiKeyHeader && bearer) return null;
	if (apiKeyHeader) return apiKeyHeader;
	return bearer && isApiKeyToken(bearer) ? bearer : null;
}
