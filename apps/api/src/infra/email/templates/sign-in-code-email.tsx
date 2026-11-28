/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ONE_TIME_CODE_PURPOSE } from '../constants/email.constants';
import { EMAIL_PREVIEW_ONE_TIME_CODE } from './_components/email-preview.constants';
import {
	OneTimeCodeEmail,
	type OneTimeCodeEmailProps,
} from './_components/one-time-code-email';

export function SignInCodeEmail(props: OneTimeCodeEmailProps) {
	return (
		<OneTimeCodeEmail {...props} purpose={ONE_TIME_CODE_PURPOSE.SIGN_IN} />
	);
}

SignInCodeEmail.PreviewProps = EMAIL_PREVIEW_ONE_TIME_CODE;

export default SignInCodeEmail;
