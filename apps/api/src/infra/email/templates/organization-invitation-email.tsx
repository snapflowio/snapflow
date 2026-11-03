/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Button, Link, Section, Text } from 'react-email';
import { EMAIL_PRODUCT_NAME } from '../constants/email.constants';
import type { EmailBrand } from '../types/email.types';
import {
	EMAIL_CLASS,
	EmailLayout,
	emailStyles,
} from './_components/email-layout';
import { EMAIL_PREVIEW_BRAND } from './_components/email-preview.constants';

export interface OrganizationInvitationEmailProps {
	brand: EmailBrand;
	organizationName: string;
	invitedBy: string;
	invitationUrl: string;
	expiresAt: string;
}

const fallbackLinkStyle = {
	...emailStyles.note,
	wordBreak: 'break-all' as const,
};

export function OrganizationInvitationEmail({
	brand,
	organizationName,
	invitedBy,
	invitationUrl,
	expiresAt,
}: OrganizationInvitationEmailProps) {
	return (
		<EmailLayout
			brand={brand}
			preview={`${invitedBy} invited you to join ${organizationName} on ${EMAIL_PRODUCT_NAME}.`}
			heading={`Join ${organizationName}`}
			footerNote={`You received this email because ${invitedBy} invited this address. If you were not expecting it, you can ignore it.`}
		>
			<Text className={EMAIL_CLASS.body} style={emailStyles.paragraph}>
				{invitedBy} invited you to join the {organizationName} organization on{' '}
				{EMAIL_PRODUCT_NAME}.
			</Text>
			<Section style={emailStyles.buttonRow}>
				<Button href={invitationUrl} style={emailStyles.button}>
					Accept invitation
				</Button>
			</Section>
			<Text className={EMAIL_CLASS.muted} style={emailStyles.note}>
				This invitation expires on {expiresAt}.
			</Text>
			<Text
				className={EMAIL_CLASS.muted}
				style={fallbackLinkStyle}
				data-skip-in-text
			>
				If the button does not work, paste this link into your browser:{' '}
				<Link
					href={invitationUrl}
					className={EMAIL_CLASS.muted}
					style={emailStyles.footerLink}
				>
					{invitationUrl}
				</Link>
			</Text>
		</EmailLayout>
	);
}

OrganizationInvitationEmail.PreviewProps = {
	brand: EMAIL_PREVIEW_BRAND,
	organizationName: 'Acme Robotics',
	invitedBy: 'Ada Lovelace',
	invitationUrl: 'http://localhost:3000/dashboard/invitations/preview',
	expiresAt: 'October 28, 2026 at 4:00 PM UTC',
} satisfies OrganizationInvitationEmailProps;

export default OrganizationInvitationEmail;
