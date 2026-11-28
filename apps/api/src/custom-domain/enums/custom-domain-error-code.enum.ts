/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum CustomDomainErrorCode {
	HOSTNAME_INVALID = 'custom_domain_hostname_invalid',
	APEX_NOT_SUPPORTED = 'custom_domain_apex_not_supported',
	HOSTNAME_RESERVED = 'custom_domain_hostname_reserved',
	ALREADY_RESERVED = 'custom_domain_already_reserved',
	NOT_FOUND = 'custom_domain_not_found',
	HTTP_EXPOSURE_NOT_FOUND = 'http_exposure_not_found',
}
