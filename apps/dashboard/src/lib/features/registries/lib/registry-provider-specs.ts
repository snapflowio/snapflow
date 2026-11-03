/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import { registryUrlSchema } from './registry-validation.ts';

const REGISTRY_PROVIDERS = [
	'generic',
	'dockerhub',
	'gcp',
	'ghcr',
	'ecr',
] as const;

export type RegistryProvider = (typeof REGISTRY_PROVIDERS)[number];

export interface RegistryProviderSpec {
	label: string;
	passwordHidden?: boolean;
	passwordLabel: string;
	passwordMultiline?: boolean;
	projectLabel?: string;
	url: string;
	urlHidden: boolean;
	username: string;
	usernameHidden?: boolean;
	usernameLabel: string;
}

export const REGISTRY_PROVIDER_SPECS: Record<
	RegistryProvider,
	RegistryProviderSpec
> = {
	dockerhub: {
		label: 'Docker Hub',
		url: 'docker.io',
		urlHidden: true,
		username: '',
		usernameLabel: 'Username',
		passwordLabel: 'Personal access token',
	},
	ecr: {
		label: 'Amazon ECR',
		url: '',
		urlHidden: false,
		username: '',
		usernameLabel: 'Role ARN',
		passwordLabel: 'Password',
		passwordHidden: true,
	},
	gcp: {
		label: 'Google Artifact',
		url: '',
		urlHidden: false,
		username: '_json_key',
		usernameHidden: true,
		usernameLabel: 'Username',
		passwordLabel: 'Service account JSON key',
		passwordMultiline: true,
		projectLabel: 'Google Cloud project ID',
	},
	generic: {
		label: 'Generic',
		url: '',
		urlHidden: false,
		username: '',
		usernameLabel: 'Username',
		passwordLabel: 'Password',
		projectLabel: 'Project',
	},
	ghcr: {
		label: 'GitHub',
		url: 'ghcr.io',
		urlHidden: true,
		username: '',
		usernameLabel: 'GitHub username',
		passwordLabel: 'Personal access token',
	},
};

export const REGISTRY_PROVIDER_TABS = REGISTRY_PROVIDERS.map((provider) => ({
	label: REGISTRY_PROVIDER_SPECS[provider].label,
	value: provider,
}));

export const DEFAULT_REGISTRY_PROVIDER: RegistryProvider = 'generic';
export const DEFAULT_REGISTRY_URL = 'docker.io';

export function registrySchema(provider: RegistryProvider) {
	const spec = REGISTRY_PROVIDER_SPECS[provider];
	return z.object({
		name: z.string().trim().min(1, 'Registry name is required'),
		password: spec.passwordHidden
			? z.string()
			: z.string().min(1, `${spec.passwordLabel} is required`),
		project: z.string(),
		url: registryUrlSchema,
		username: spec.usernameHidden
			? z.string()
			: z.string().trim().min(1, `${spec.usernameLabel} is required`),
	});
}

export type RegistryValues = z.infer<ReturnType<typeof registrySchema>>;

export function registryDefaults(provider: RegistryProvider): RegistryValues {
	const spec = REGISTRY_PROVIDER_SPECS[provider];
	return {
		name: '',
		url: spec.url,
		username: spec.username,
		password: '',
		project: '',
	};
}

export function isRegistryProvider(value: string): value is RegistryProvider {
	return value in REGISTRY_PROVIDER_SPECS;
}

export function registryUrlPlaceholder(provider: RegistryProvider): string {
	if (provider === 'ecr') return '123456789012.dkr.ecr.us-east-1.amazonaws.com';
	if (provider === 'gcp') return 'us-central1-docker.pkg.dev';
	return 'registry.example.com';
}

export function registryUsernamePlaceholder(
	provider: RegistryProvider
): string | undefined {
	return provider === 'ecr'
		? 'arn:aws:iam::123456789012:role/snapflow-ecr-puller'
		: undefined;
}
