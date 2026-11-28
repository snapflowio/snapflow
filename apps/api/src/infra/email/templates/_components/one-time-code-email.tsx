/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Section, Text } from 'react-email';
import {
	EMAIL_COLORS,
	EMAIL_MONO_FONT_STACK,
	ONE_TIME_CODE_COPY,
	type OneTimeCodePurpose,
} from '../../constants/email.constants';
import type { EmailBrand } from '../../types/email.types';
import { EMAIL_CLASS, EmailLayout, emailStyles } from './email-layout';

export interface OneTimeCodeEmailProps {
	brand: EmailBrand;
	code: string;
	expiresInMinutes: number;
}

const codeStyle = {
	margin: 0,
	color: EMAIL_COLORS.heading,
	fontFamily: EMAIL_MONO_FONT_STACK,
	fontSize: '32px',
	fontWeight: 600,
	lineHeight: '40px',
	letterSpacing: '0.24em',
} as const;

export function OneTimeCodeEmail({
	brand,
	code,
	purpose,
	expiresInMinutes,
}: OneTimeCodeEmailProps & { purpose: OneTimeCodePurpose }) {
	const copy = ONE_TIME_CODE_COPY[purpose];
	return (
		<EmailLayout
			brand={brand}
			preview={copy.preview}
			heading={copy.heading}
			footerNote={copy.ignoreNote}
		>
			<Text className={EMAIL_CLASS.body} style={emailStyles.paragraph}>
				{copy.instruction}
			</Text>
			<Section className={EMAIL_CLASS.surface} style={emailStyles.surface}>
				<Text className={EMAIL_CLASS.heading} style={codeStyle}>
					{code}
				</Text>
			</Section>
			<Text className={EMAIL_CLASS.muted} style={emailStyles.note}>
				This code expires in {expiresInMinutes} minutes. Never share it with
				anyone; Snapflow will never ask you for it.
			</Text>
		</EmailLayout>
	);
}
