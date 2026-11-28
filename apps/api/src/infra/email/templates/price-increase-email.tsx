/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Text } from 'react-email';
import type { EmailBrand } from '../types/email.types';
import {
	EMAIL_CLASS,
	EmailLayout,
	emailStyles,
} from './_components/email-layout';
import { EMAIL_PREVIEW_BRAND } from './_components/email-preview.constants';

export interface PriceIncreaseEmailProps {
	brand: EmailBrand;
	sandboxName: string;
	currentHourlyUsd: string;
	newHourlyUsd: string;
	effectiveAt: string;
}

export function PriceIncreaseEmail({
	brand,
	sandboxName,
	currentHourlyUsd,
	newHourlyUsd,
	effectiveAt,
}: PriceIncreaseEmailProps) {
	return (
		<EmailLayout
			brand={brand}
			preview={`The machine running ${sandboxName} raised its price.`}
			heading={`A price change for ${sandboxName}`}
			footerNote="You received this email because your organization runs a sandbox on this machine."
		>
			<Text className={EMAIL_CLASS.body} style={emailStyles.paragraph}>
				The machine running {sandboxName} raised its price from $
				{currentHourlyUsd} to ${newHourlyUsd} an hour. The sandbox keeps its
				current price until {effectiveAt} or its next start, whichever comes
				first.
			</Text>
			<Text className={EMAIL_CLASS.muted} style={emailStyles.note}>
				A sandbox whose maximum price is below the new price stops then and
				keeps its disk.
			</Text>
		</EmailLayout>
	);
}

PriceIncreaseEmail.PreviewProps = {
	brand: EMAIL_PREVIEW_BRAND,
	sandboxName: 'build-runner',
	currentHourlyUsd: '0.045',
	newHourlyUsd: '0.054',
	effectiveAt: 'December 12, 2026',
} satisfies PriceIncreaseEmailProps;

export default PriceIncreaseEmail;
