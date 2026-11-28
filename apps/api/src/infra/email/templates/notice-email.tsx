/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Button, Link, Section, Text } from 'react-email';
import { ORGANIZATION_NOTICE_FOOTER } from '../constants/email.constants';
import type { EmailBrand, EmailNoticeAction } from '../types/email.types';
import {
	EMAIL_CLASS,
	EmailLayout,
	emailStyles,
} from './_components/email-layout';
import { EMAIL_PREVIEW_BRAND } from './_components/email-preview.constants';

export interface NoticeEmailProps {
	brand: EmailBrand;
	heading: string;
	paragraphs: readonly string[];
	note: string;
	action: EmailNoticeAction | null;
	footerNote?: string;
}

const fallbackLinkStyle = {
	...emailStyles.note,
	wordBreak: 'break-all' as const,
};

export function NoticeEmail({
	brand,
	heading,
	paragraphs,
	note,
	action,
	footerNote = ORGANIZATION_NOTICE_FOOTER,
}: NoticeEmailProps) {
	return (
		<EmailLayout
			brand={brand}
			preview={paragraphs[0] ?? heading}
			heading={heading}
			footerNote={footerNote}
		>
			{paragraphs.map((paragraph) => (
				<Text
					key={paragraph}
					className={EMAIL_CLASS.body}
					style={emailStyles.paragraph}
				>
					{paragraph}
				</Text>
			))}
			{action && (
				<Section style={emailStyles.buttonRow}>
					<Button href={action.url} style={emailStyles.button}>
						{action.label}
					</Button>
				</Section>
			)}
			<Text className={EMAIL_CLASS.muted} style={emailStyles.note}>
				{note}
			</Text>
			{action && (
				<Text
					className={EMAIL_CLASS.muted}
					style={fallbackLinkStyle}
					data-skip-in-text
				>
					If the button does not work, paste this link into your browser:{' '}
					<Link
						href={action.url}
						className={EMAIL_CLASS.muted}
						style={emailStyles.footerLink}
					>
						{action.url}
					</Link>
				</Text>
			)}
		</EmailLayout>
	);
}

NoticeEmail.PreviewProps = {
	brand: EMAIL_PREVIEW_BRAND,
	heading: 'Less than an hour of balance left',
	paragraphs: [
		'At $1.20 an hour, the balance of Acme lasts about 58 minutes.',
		'When it runs out, every sandbox stops and is archived.',
	],
	note: 'Deposit USDC or turn on auto top-up to keep your sandboxes running.',
	action: {
		label: 'Add funds',
		url: 'http://localhost:3000/dashboard/billing/funding',
	},
} satisfies NoticeEmailProps;

export default NoticeEmail;
