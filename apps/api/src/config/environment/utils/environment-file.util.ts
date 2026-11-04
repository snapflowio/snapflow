/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { z } from 'zod';
import { DeploymentEnvironment } from '../../enums/deployment-environment.enum';
import { ENVIRONMENT_NAMESPACES } from '../registry.environment';
import { ENVIRONMENT_METADATA } from './environment-variable.util';

const SECTION_PREFIX = '# ';
const LINE_SEPARATOR = '\n';
const SECTION_SEPARATOR = '\n\n';
const DISABLED_PREFIX = '#';
const VARIABLE_LINE = /^#?([A-Z0-9_]+)=/;

interface EnvironmentFileLayout {
	content: string;
	added: string[];
	unregistered: string[];
}

function environmentFileSections(): { title: string; names: string[] }[] {
	return ENVIRONMENT_NAMESPACES.map((namespace) => {
		const shape: Readonly<Record<string, z.ZodType>> = namespace.schema.shape;
		return {
			title: namespace.title,
			names: Object.keys(shape).filter((name) => {
				const allowedIn = ENVIRONMENT_METADATA.get(shape[name])?.allowedIn;
				return (
					!allowedIn || allowedIn.includes(DeploymentEnvironment.DEVELOPMENT)
				);
			}),
		};
	});
}

function variableLines(content: string): Map<string, string> {
	const lines = new Map<string, string>();
	for (const line of content.split(LINE_SEPARATOR)) {
		const name = VARIABLE_LINE.exec(line)?.[1];
		if (!name) continue;
		const existing = lines.get(name);
		if (!existing || existing.startsWith(DISABLED_PREFIX))
			lines.set(name, line);
	}
	return lines;
}

export function layoutEnvironmentFile(content: string): EnvironmentFileLayout {
	const lines = variableLines(content);
	const sections = environmentFileSections().filter(
		(section) => section.names.length > 0
	);
	const registered = new Set(sections.flatMap((section) => section.names));
	const blocks = sections.map(({ title, names }) =>
		[
			`${SECTION_PREFIX}${title}`,
			...names.map((name) => lines.get(name) ?? `${name}=`),
		].join(LINE_SEPARATOR)
	);
	return {
		content: `${blocks.join(SECTION_SEPARATOR)}${LINE_SEPARATOR}`,
		added: [...registered].filter((name) => !lines.has(name)),
		unregistered: [...lines.keys()].filter((name) => !registered.has(name)),
	};
}
