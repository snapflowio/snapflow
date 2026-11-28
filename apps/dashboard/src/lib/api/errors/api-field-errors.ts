/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ApiError } from '@snapflow/api-client';
import { SnapflowError } from './snapflow-error.ts';

const CONFLICT_STATUS = 409;
const PROPERTY_PATH_SEPARATOR = '.';
const ARRAY_INDEX_PATTERN = /\.\d+(?=\.|$)/g;
const VALIDATION_PROPERTIES = [
	'errors',
	'message',
] as const satisfies readonly (keyof ApiError)[];

export interface ApiFieldErrorMapping<Field extends string> {
	properties: Readonly<Partial<Record<string, Field>>>;
	conflict?: Field;
}

export type ApiFieldErrors<Field extends string> = Partial<
	Record<Field, string>
>;

function validationMessages(error: SnapflowError): string[] {
	const { details } = error;
	if (typeof details === 'object' && details !== null) {
		for (const property of VALIDATION_PROPERTIES) {
			const messages: unknown = Reflect.get(details, property);
			if (Array.isArray(messages)) {
				return messages.filter(
					(message): message is string => typeof message === 'string'
				);
			}
		}
	}
	return [error.message];
}

function propertyCandidates(message: string): string[] {
	const [path = ''] = message.split(' ', 1);
	const normalized = path.replaceAll(ARRAY_INDEX_PATTERN, '');
	const segments = normalized.split(PROPERTY_PATH_SEPARATOR);
	return segments
		.map((_, index) =>
			segments.slice(0, segments.length - index).join(PROPERTY_PATH_SEPARATOR)
		)
		.filter(Boolean);
}

function sentenceCase(message: string): string {
	return `${message.charAt(0).toUpperCase()}${message.slice(1)}`;
}

export function apiFieldErrors<Field extends string>(
	error: unknown,
	mapping: ApiFieldErrorMapping<Field>
): ApiFieldErrors<Field> {
	const apiError = SnapflowError.fromUnknown(error);
	const errors: ApiFieldErrors<Field> = {};
	if (apiError.status === CONFLICT_STATUS && mapping.conflict) {
		errors[mapping.conflict] = apiError.message;
		return errors;
	}
	for (const message of validationMessages(apiError)) {
		const property = propertyCandidates(message).find((candidate) =>
			Object.hasOwn(mapping.properties, candidate)
		);
		const field = property ? mapping.properties[property] : undefined;
		if (field && !errors[field]) errors[field] = sentenceCase(message);
	}
	return errors;
}

export function hasApiFieldErrors<Field extends string>(
	errors: ApiFieldErrors<Field>
): boolean {
	return Object.keys(errors).length > 0;
}
