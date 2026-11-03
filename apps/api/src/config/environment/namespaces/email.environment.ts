/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import {
	DEVELOPMENT_ONLY,
	PRODUCTION_ONLY,
} from '../../constants/deployment-environment.constants';
import {
	emailAddressText,
	mailboxText,
	originText,
	resendApiKeyText,
} from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const emailEnvironment = defineEnvironment(
	{
		name: 'email',
		title: 'Email',
		description: 'Transactional email sent through Resend',
		note: 'In development, set RESEND_BASE_URL to the devcontainer Resend emulator and any re_ key to capture email locally; without RESEND_API_KEY the API starts but every email send fails.',
	},
	{
		RESEND_API_KEY: environmentVariable(resendApiKeyText().optional(), {
			description:
				'Resend API key with sending access to the EMAIL_FROM domain.',
			secret: true,
			requiredIn: PRODUCTION_ONLY,
		}),
		EMAIL_FROM: environmentVariable(mailboxText().optional(), {
			description:
				'Sender of platform email on a domain verified in Resend, as an address or "Display Name <address>"; required with RESEND_API_KEY.',
			requiredIn: PRODUCTION_ONLY,
		}),
		EMAIL_REPLY_TO: environmentVariable(emailAddressText().optional(), {
			description: 'Reply-To address of platform email.',
		}),
		RESEND_BASE_URL: environmentVariable(originText().optional(), {
			description:
				'Origin of a local Resend API emulator that captures email instead of sending it; unset sends through https://api.resend.com.',
			allowedIn: DEVELOPMENT_ONLY,
		}),
	}
);
