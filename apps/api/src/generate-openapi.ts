/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { createOpenApiDocument } from './app/http/openapi.config';
import { ApiAppModule } from './app/root/app.module';

const GENERATION_TIMEOUT_MILLISECONDS = 30_000;

async function generateOpenAPI() {
	try {
		const app = await NestFactory.create(ApiAppModule, {
			logger: ['error'],
			preview: true,
		});

		const document = createOpenApiDocument(app);
		const openapiPath = './dist/apps/api/openapi.json';
		fs.mkdirSync(path.dirname(openapiPath), { recursive: true });
		fs.writeFileSync(openapiPath, JSON.stringify(document, null, 2));

		const document_3_1_0 = {
			...createOpenApiDocument(app),
			openapi: '3.1.0',
		};
		const openapi310Path = './dist/apps/api/openapi.3.1.0.json';
		fs.mkdirSync(path.dirname(openapi310Path), { recursive: true });
		fs.writeFileSync(openapi310Path, JSON.stringify(document_3_1_0, null, 2));

		await app.close();
		console.log('OpenAPI specification generated successfully!');
		clearTimeout(timeout);
		process.exit(0);
	} catch (error) {
		console.error('Failed to generate OpenAPI specification:', error);
		clearTimeout(timeout);
		process.exit(1);
	}
}

const timeout = setTimeout(() => {
	console.error('Generation timed out after 30 seconds');
	process.exit(1);
}, GENERATION_TIMEOUT_MILLISECONDS);

process.on('exit', () => {
	clearTimeout(timeout);
});

await generateOpenAPI();
