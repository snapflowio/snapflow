/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { APIError } from 'better-auth/api';
import { AUTH_ERROR } from '../../constants/auth-errors.constants';
import type { DisposableEmailService } from '../../services/disposable-email.service';
import type { AuthMiddlewareContext } from '../hooks/request-session';

export interface DisposableEmailDependencies {
	disposableEmails: Pick<DisposableEmailService, 'isDisposable'>;
}

export async function assertPermanentEmail(
	{ disposableEmails }: DisposableEmailDependencies,
	email: string
): Promise<void> {
	if (await disposableEmails.isDisposable(email)) {
		throw APIError.from('BAD_REQUEST', AUTH_ERROR.DISPOSABLE_EMAIL);
	}
}

export async function assertSignUpEmailPermanent(
	{ disposableEmails }: DisposableEmailDependencies,
	context: AuthMiddlewareContext
): Promise<void> {
	const email: unknown = context.body?.email;
	if (typeof email !== 'string') return;
	if (!(await disposableEmails.isDisposable(email))) return;
	if (await context.context.internalAdapter.findUserByEmail(email)) return;
	throw APIError.from('BAD_REQUEST', AUTH_ERROR.DISPOSABLE_EMAIL);
}
