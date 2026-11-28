/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum AuthErrorCode {
	MULTIPLE_CREDENTIALS = 'multiple_credentials',
	CROSS_SITE_REQUEST_DENIED = 'cross_site_request_denied',
	UNTRUSTED_ORIGIN = 'untrusted_origin',
	API_KEY_NOT_FOUND = 'api_key_not_found',
}
