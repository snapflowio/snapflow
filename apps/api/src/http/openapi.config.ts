/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { INestApplication } from '@nestjs/common';
import {
	DocumentBuilder,
	type OpenAPIObject,
	SwaggerModule,
} from '@nestjs/swagger';

const getOpenApiConfig = () =>
	new DocumentBuilder()
		.setTitle('Snapflow')
		.addServer('http://localhost:3000')
		.setDescription('Snapflow AI platform API Docs')
		.setContact(
			'Snapflow Platforms Inc.',
			'https://www.snapflow.io',
			'support@snapflow.com'
		)
		.setVersion('1.0')
		.setLicense('Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0')
		.addBearerAuth({
			type: 'http',
			scheme: 'bearer',
			description: 'API Key access',
		})
		.addCookieAuth('snapflow.session_token', {
			type: 'apiKey',
			in: 'cookie',
			description: 'Better Auth session cookie',
		})
		.build();

function compareKeys(left: string, right: string): number {
	if (left < right) return -1;
	return left > right ? 1 : 0;
}

function sortedRecord<T>(record: Record<string, T>): Record<string, T> {
	return Object.fromEntries(
		Object.entries(record).sort(([left], [right]) => compareKeys(left, right))
	);
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
	const document = SwaggerModule.createDocument(app, getOpenApiConfig());
	const { components, tags } = document;
	return {
		...document,
		paths: sortedRecord(document.paths),
		tags:
			tags &&
			[...tags].sort((left, right) => compareKeys(left.name, right.name)),
		components: components && {
			...components,
			schemas: components.schemas && sortedRecord(components.schemas),
		},
	};
}
