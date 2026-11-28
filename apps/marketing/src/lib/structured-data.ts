/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SITE_CONFIG } from '@/config/site';
import { FAQS } from '@/data/faqs';

const SCHEMA_CONTEXT = 'https://schema.org';
const LOGO_PATH = '/assets/snapflow-logo.svg';

export function landingStructuredData() {
	return {
		'@context': SCHEMA_CONTEXT,
		'@graph': [
			{
				'@type': 'Organization',
				name: SITE_CONFIG.NAME,
				url: SITE_CONFIG.URL,
				logo: new URL(LOGO_PATH, SITE_CONFIG.URL).href,
				email: SITE_CONFIG.SUPPORT_EMAIL,
				sameAs: [SITE_CONFIG.DISCORD_URL],
			},
			{
				'@type': 'FAQPage',
				mainEntity: FAQS.map(([question, answer]) => ({
					'@type': 'Question',
					name: question,
					acceptedAnswer: {
						'@type': 'Answer',
						text: answer,
					},
				})),
			},
		],
	};
}
