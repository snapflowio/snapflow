/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { SocialProvider } from '../../auth/constants/social-provider.constants';

@ApiSchema({ name: 'PublicConfig' })
export class PublicConfigDto {
	@ApiProperty({ description: 'Public origin of the marketing website' })
	websiteUrl: string;

	@ApiProperty({
		description: 'Social sign-in providers enabled on this deployment',
		enum: Object.values(SocialProvider),
		enumName: 'SocialProvider',
		isArray: true,
	})
	socialProviders: SocialProvider[];

	@ApiProperty({
		description: 'Stripe publishable key for Stripe.js and Connect.js',
	})
	stripePublishableKey: string;
}
