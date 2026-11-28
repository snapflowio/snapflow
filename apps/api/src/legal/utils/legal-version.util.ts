/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
	type AuthCredential,
	isImpersonatedSession,
} from '../../common/types/organization-auth-context.types';
import { apiError } from '../../common/utils/error/api-error.util';
import { LegalErrorCode } from '../constants/legal-documents.constants';

export function assertCurrentVersion(accepted: string, current: string): void {
	if (accepted === current) return;
	throw new BadRequestException(
		apiError(
			LegalErrorCode.TERMS_VERSION_OUTDATED,
			`Version ${accepted} is not the current one (${current}); reload the page and accept the current version`
		)
	);
}

export function assertAcceptedBySelf(credential: AuthCredential): void {
	if (!isImpersonatedSession(credential)) return;
	throw new ForbiddenException(
		apiError(
			LegalErrorCode.TERMS_ACCEPTANCE_IMPERSONATED,
			'Terms can only be accepted by the user themselves, not while an administrator impersonates them'
		)
	);
}
