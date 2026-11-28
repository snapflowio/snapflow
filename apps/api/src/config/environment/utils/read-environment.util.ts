/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { z } from 'zod';
import { DEPLOYMENT_PROFILES } from '../../constants/deployment-profile.constants';
import { type DeploymentProfile } from '../../types/deployment-profile.types';
import { processEnvironment } from '../namespaces/process.environment';
import {
	BASE_ENVIRONMENT_NAMESPACES,
	type EnvironmentValues,
	type RegisteredNamespace,
} from '../registry.environment';
import { ENVIRONMENT_METADATA } from './environment-variable.util';

type BaseNamespace = (typeof BASE_ENVIRONMENT_NAMESPACES)[number];

export interface ParsedEnvironment<Namespace extends RegisteredNamespace> {
	readonly profile: DeploymentProfile;
	readonly values: EnvironmentValues<Namespace | BaseNamespace>;
}

type Input = Readonly<Record<string, string>>;

function providedValues(source: NodeJS.ProcessEnv): Input {
	return Object.fromEntries(
		Object.entries(source).flatMap(([name, value]) => {
			const trimmed = value?.trim();
			return trimmed ? [[name, trimmed]] : [];
		})
	);
}

function readProfile(provided: Input): DeploymentProfile {
	const selector = processEnvironment.schema.shape.SNAPFLOW_ENVIRONMENT;
	const parsed = selector.safeParse(provided.SNAPFLOW_ENVIRONMENT);
	if (!parsed.success) {
		throw new Error(
			`SNAPFLOW_ENVIRONMENT must be one of: ${selector.options.join(', ')}`
		);
	}
	return DEPLOYMENT_PROFILES[parsed.data];
}

function profileIssues(
	name: string,
	schema: z.ZodType,
	profile: DeploymentProfile,
	provided: Input
): string[] {
	const meta = ENVIRONMENT_METADATA.get(schema);
	const issues: string[] = [];
	if (
		provided[name] !== undefined &&
		meta?.allowedIn &&
		!meta.allowedIn.includes(profile.name)
	) {
		issues.push(`${name} is not allowed in ${profile.name}`);
	}
	if (
		provided[name] === undefined &&
		meta?.requiredIn?.includes(profile.name)
	) {
		issues.push(`${name} is required in ${profile.name}`);
	}
	return issues;
}

function schemaIssues(
	namespace: RegisteredNamespace,
	input: Input
): { data: Record<string, unknown> | null; issues: string[] } {
	const parsed = namespace.schema.safeParse(input);
	if (parsed.success) return { data: parsed.data, issues: [] };
	return {
		data: null,
		issues: parsed.error.issues.map((issue) => {
			const name = issue.path.join('.');
			return input[name] === undefined
				? `${name} is required`
				: `${name} ${issue.message}`;
		}),
	};
}

export function readEnvironment<
	const Namespaces extends readonly RegisteredNamespace[],
>(
	source: NodeJS.ProcessEnv,
	namespaces: Namespaces
): ParsedEnvironment<Namespaces[number]> {
	const provided = providedValues(source);
	const profile = readProfile(provided);
	const issues: string[] = [];
	const values: Record<string, unknown> = {};
	for (const namespace of new Set([
		...BASE_ENVIRONMENT_NAMESPACES,
		...namespaces,
	])) {
		for (const [name, schema] of Object.entries(namespace.schema.shape)) {
			issues.push(...profileIssues(name, schema, profile, provided));
		}
		const parsed = schemaIssues(namespace, provided);
		issues.push(...parsed.issues);
		Object.assign(values, parsed.data);
	}
	if (issues.length > 0) {
		throw new Error(
			`Invalid ${profile.name} environment:\n- ${[...new Set(issues)].join('\n- ')}`
		);
	}
	return {
		profile,
		values: values as EnvironmentValues<Namespaces[number] | BaseNamespace>,
	};
}
