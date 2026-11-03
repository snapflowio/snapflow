/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { z } from 'zod';
import { authenticationEnvironment } from './namespaces/authentication.environment';
import { cloudflareEnvironment } from './namespaces/cloudflare.environment';
import { databaseEnvironment } from './namespaces/database.environment';
import { developmentEnvironment } from './namespaces/development.environment';
import { emailEnvironment } from './namespaces/email.environment';
import { geoIpEnvironment } from './namespaces/geo-ip.environment';
import { networkEnvironment } from './namespaces/network.environment';
import { observabilityEnvironment } from './namespaces/observability.environment';
import { processEnvironment } from './namespaces/process.environment';
import { publicUrlsEnvironment } from './namespaces/public-urls.environment';
import { redisEnvironment } from './namespaces/redis.environment';
import { snapshotManagerEnvironment } from './namespaces/snapshot-manager.environment';
import { socialSignInEnvironment } from './namespaces/social-sign-in.environment';
import { objectStorageEnvironment } from './namespaces/storage.environment';
import { stripeEnvironment } from './namespaces/stripe.environment';
import { vaultEnvironment } from './namespaces/vault.environment';

export const BASE_ENVIRONMENT_NAMESPACES = [
	processEnvironment,
	observabilityEnvironment,
] as const;

export const ENVIRONMENT_NAMESPACES = [
	...BASE_ENVIRONMENT_NAMESPACES,
	publicUrlsEnvironment,
	networkEnvironment,
	authenticationEnvironment,
	socialSignInEnvironment,
	databaseEnvironment,
	redisEnvironment,
	emailEnvironment,
	objectStorageEnvironment,
	snapshotManagerEnvironment,
	geoIpEnvironment,
	vaultEnvironment,
	cloudflareEnvironment,
	stripeEnvironment,
	developmentEnvironment,
] as const;

export type RegisteredNamespace = (typeof ENVIRONMENT_NAMESPACES)[number];

type UnionToIntersection<Union> = (
	Union extends unknown
		? (value: Union) => void
		: never
) extends (value: infer Intersection) => void
	? Intersection
	: never;

export type EnvironmentValues<
	Namespace extends RegisteredNamespace = RegisteredNamespace,
> = UnionToIntersection<
	Namespace extends RegisteredNamespace ? z.output<Namespace['schema']> : never
>;

type NamespaceVariableName<Namespace> = Namespace extends RegisteredNamespace
	? keyof z.input<Namespace['schema']> & string
	: never;

export type EnvironmentVariableName =
	NamespaceVariableName<RegisteredNamespace>;
