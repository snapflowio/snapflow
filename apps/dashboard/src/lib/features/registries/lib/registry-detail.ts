/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	DockerRegistry,
	UpdateDockerRegistry,
} from '@snapflow/api-client';
import * as z from 'zod';
import { registryUrlSchema } from './registry-validation.ts';

export const REGISTRY_TEXT_FIELDS = [
	'name',
	'url',
	'username',
	'project',
] as const;

export type RegistryTextField = (typeof REGISTRY_TEXT_FIELDS)[number];

export type RegistryDraft = Record<RegistryTextField | 'password', string>;

export type RegistryDraftErrors = Partial<Record<keyof RegistryDraft, string>>;

interface RegistryFieldSpec {
	key: keyof RegistryDraft;
	title: string;
	placeholder: string;
	secret?: boolean;
}

export const REGISTRY_FIELDS: readonly RegistryFieldSpec[] = [
	{ key: 'name', title: 'Name', placeholder: 'production-registry' },
	{ key: 'url', title: 'URL', placeholder: 'docker.io' },
	{ key: 'username', title: 'Username', placeholder: 'myusername' },
	{
		key: 'password',
		title: 'Password',
		placeholder: 'Leave blank to keep the current password',
		secret: true,
	},
	{ key: 'project', title: 'Project', placeholder: 'my-project' },
];

const registryDraftSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	url: registryUrlSchema,
	username: z.string().trim().min(1, 'Username is required'),
	password: z.string(),
	project: z.string(),
});

export function savedRegistryDraft(registry: DockerRegistry): RegistryDraft {
	return {
		name: registry.name,
		url: registry.url,
		username: registry.username,
		project: registry.project ?? '',
		password: '',
	};
}

function isDraftField(field: unknown): field is keyof RegistryDraft {
	return (
		field === 'password' ||
		REGISTRY_TEXT_FIELDS.some((textField) => textField === field)
	);
}

export function registryDraftErrors(draft: RegistryDraft): RegistryDraftErrors {
	const parsed = registryDraftSchema.safeParse(draft);
	if (parsed.success) return {};
	const errors: RegistryDraftErrors = {};
	for (const issue of parsed.error.issues) {
		const [field] = issue.path;
		if (isDraftField(field)) errors[field] ??= issue.message;
	}
	return errors;
}

export function toUpdateRegistry(draft: RegistryDraft): UpdateDockerRegistry {
	return {
		name: draft.name.trim(),
		url: draft.url.trim(),
		username: draft.username.trim(),
		password: draft.password.trim() || undefined,
		project: draft.project.trim() || undefined,
	};
}
