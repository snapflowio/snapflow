/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ForbiddenException } from '@nestjs/common';
import {
	AUTH_CREDENTIAL_TYPES,
	type AuthCredential,
	isImpersonatedSession,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { apiError } from '../../common/utils/error/api-error.util';
import {
	LEGAL_DOCUMENT_VERSION,
	LegalErrorCode,
} from '../constants/legal-documents.constants';

export type TermsActor = Pick<
	OrganizationAuthContext,
	'acceptedTermsVersion' | 'credential'
>;

export function hasAcceptedTerms(actor: TermsActor): boolean {
	return (
		actor.acceptedTermsVersion === LEGAL_DOCUMENT_VERSION.TERMS ||
		isImpersonatedSession(actor.credential)
	);
}

export function termsAcceptanceRequired(
	credential: AuthCredential
): ForbiddenException {
	const subject =
		credential.type === AUTH_CREDENTIAL_TYPES.API_KEY
			? 'The user who created this API key has'
			: 'You have';
	return new ForbiddenException(
		apiError(
			LegalErrorCode.TERMS_ACCEPTANCE_REQUIRED,
			`${subject} not accepted the current Terms of Service (version ${LEGAL_DOCUMENT_VERSION.TERMS}). Reading, stopping and deleting resources and withdrawing funds still work; sign in to the Snapflow dashboard and accept them to make other changes.`
		)
	);
}
