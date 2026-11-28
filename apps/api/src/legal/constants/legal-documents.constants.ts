/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const LEGAL_DOCUMENT_VERSION = {
	TERMS: '2026-11-25',
	HOST_TERMS: '2026-11-18',
} as const;

export const LegalErrorCode = {
	TERMS_VERSION_OUTDATED: 'terms_version_outdated',
	TERMS_ACCEPTANCE_REQUIRED: 'terms_acceptance_required',
	TERMS_ACCEPTANCE_IMPERSONATED: 'terms_acceptance_impersonated',
} as const;
