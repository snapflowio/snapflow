/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';
import type { DeploymentEnvironment } from '../../enums/deployment-environment.enum';

export type EnvironmentVariableMeta = {
	description: string;
	secret?: boolean;
	requiredIn?: readonly DeploymentEnvironment[];
	allowedIn?: readonly DeploymentEnvironment[];
};

export const ENVIRONMENT_METADATA = z.registry<EnvironmentVariableMeta>();

export function environmentVariable<Schema extends z.ZodType>(
	schema: Schema,
	meta: EnvironmentVariableMeta
): Schema {
	ENVIRONMENT_METADATA.add(schema, meta);
	return schema;
}

export type EnvironmentShape = Readonly<Record<string, z.ZodType>>;

interface EnvironmentGroup {
	readonly title: string;
	readonly description: string;
	readonly note?: string;
}

export interface EnvironmentNamespace<Shape extends EnvironmentShape>
	extends EnvironmentGroup {
	readonly schema: z.ZodObject<Shape>;
}

export function defineEnvironment<const Shape extends EnvironmentShape>(
	group: EnvironmentGroup,
	variables: Shape
): EnvironmentNamespace<Shape> {
	return { ...group, schema: z.object(variables) };
}
