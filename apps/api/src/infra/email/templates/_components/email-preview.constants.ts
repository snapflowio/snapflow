/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EmailBrand } from '../../types/email.types';
import type { OneTimeCodeEmailProps } from './one-time-code-email';

export const EMAIL_PREVIEW_BRAND: EmailBrand = {
	websiteUrl: 'http://localhost:4321',
};

export const EMAIL_PREVIEW_ONE_TIME_CODE: OneTimeCodeEmailProps = {
	brand: EMAIL_PREVIEW_BRAND,
	code: '482913',
	expiresInMinutes: 10,
};
