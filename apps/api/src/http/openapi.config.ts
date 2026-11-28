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
	type OperationObject,
	type PathItemObject,
	SwaggerModule,
	type TagObject,
} from '@nestjs/swagger';
import {
	OPENAPI_TAG_DEFINITIONS,
	type OpenApiTag,
} from '../common/constants/openapi.constants';

const OPENAPI_DOCUMENT = {
	title: 'Snapflow API',
	description:
		'Run sandboxes on independently hosted machines, publish their ports, and manage the machines you host.',
	version: '1.0',
	serverDescription: 'Snapflow',
	contact: {
		name: 'Snapflow',
		url: 'https://snapflow.io',
		email: 'support@snapflow.io',
	},
	license: {
		name: 'AGPL-3.0-only',
		url: 'https://www.gnu.org/licenses/agpl-3.0.html',
	},
	sessionCookie: 'snapflow.session_token',
} as const;

const HTTP_METHODS = [
	'get',
	'put',
	'post',
	'delete',
	'options',
	'head',
	'patch',
	'trace',
] as const satisfies readonly (keyof PathItemObject)[];

const REGISTERED_TAGS: ReadonlySet<string> = new Set(
	OPENAPI_TAG_DEFINITIONS.map(({ name }) => name)
);

export interface OpenApiDocumentOptions {
	serverUrl: string;
}

const getOpenApiConfig = ({ serverUrl }: OpenApiDocumentOptions) =>
	new DocumentBuilder()
		.setTitle(OPENAPI_DOCUMENT.title)
		.setDescription(OPENAPI_DOCUMENT.description)
		.setVersion(OPENAPI_DOCUMENT.version)
		.addServer(serverUrl, OPENAPI_DOCUMENT.serverDescription)
		.setContact(
			OPENAPI_DOCUMENT.contact.name,
			OPENAPI_DOCUMENT.contact.url,
			OPENAPI_DOCUMENT.contact.email
		)
		.setLicense(OPENAPI_DOCUMENT.license.name, OPENAPI_DOCUMENT.license.url)
		.addBearerAuth({
			type: 'http',
			scheme: 'bearer',
			description: 'An organization API key created in the dashboard.',
		})
		.addCookieAuth(OPENAPI_DOCUMENT.sessionCookie, {
			type: 'apiKey',
			in: 'cookie',
			description: 'The dashboard session cookie.',
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

function operations(
	paths: OpenAPIObject['paths']
): { route: string; operation: OperationObject }[] {
	return Object.entries(paths).flatMap(([path, item]) =>
		HTTP_METHODS.flatMap((method) => {
			const operation = item[method];
			return operation
				? [{ route: `${method.toUpperCase()} ${path}`, operation }]
				: [];
		})
	);
}

function assertRegisteredTags(paths: OpenAPIObject['paths']): void {
	const unregistered = operations(paths)
		.filter(
			({ operation }) =>
				!operation.tags?.length ||
				operation.tags.some((tag) => !REGISTERED_TAGS.has(tag))
		)
		.map(({ route, operation }) => `${route} [${operation.tags ?? []}]`);
	if (unregistered.length > 0) {
		throw new Error(
			`OpenAPI operations must carry tags registered in OPENAPI_TAG_DEFINITIONS: ${unregistered.join(', ')}`
		);
	}
}

function usedTags(paths: OpenAPIObject['paths']): ReadonlySet<OpenApiTag> {
	return new Set(
		operations(paths).flatMap(
			({ operation }) => (operation.tags ?? []) as OpenApiTag[]
		)
	);
}

function documentTags(paths: OpenAPIObject['paths']): TagObject[] {
	const used = usedTags(paths);
	return OPENAPI_TAG_DEFINITIONS.filter(({ name }) => used.has(name)).map(
		({ name, description }) => ({ name, description })
	);
}

export function createOpenApiDocument(
	app: INestApplication,
	options: OpenApiDocumentOptions
): OpenAPIObject {
	const document = SwaggerModule.createDocument(app, getOpenApiConfig(options));
	assertRegisteredTags(document.paths);
	const { components } = document;
	return {
		...document,
		paths: sortedRecord(document.paths),
		tags: documentTags(document.paths),
		components: components && {
			...components,
			schemas: components.schemas && sortedRecord(components.schemas),
		},
	};
}
