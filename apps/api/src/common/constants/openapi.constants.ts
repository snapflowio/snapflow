/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const HOSTED_API_SERVER_URL = 'https://snapflow.io/api';

export const OpenApiTag = {
	SANDBOXES: 'Sandboxes',
	SNAPSHOTS: 'Snapshots',
	VOLUMES: 'Volumes',
	EXPOSURES: 'Exposures',
	CUSTOM_DOMAINS: 'Custom domains',
	SECRETS: 'Secrets',
	REGISTRIES: 'Registries',
	OBJECT_STORAGE: 'Object storage',
	WEBHOOKS: 'Webhooks',
	LISTINGS: 'Listings',
	MACHINES: 'Machines',
	HOST_PROFILE: 'Host profile',
	ABUSE: 'Abuse',
	ORGANIZATIONS: 'Organizations',
	API_KEYS: 'API keys',
	USERS: 'Users',
	AUDIT_LOGS: 'Audit logs',
	NETWORK_USAGE: 'Network usage',
	BILLING: 'Billing',
	SETTLEMENT: 'Settlement',
	WALLETS: 'Wallets',
	USER_WALLET: 'User wallet',
	PUBLIC_CONFIGURATION: 'Public configuration',
	HEALTH: 'Health',
	ADMIN: 'Admin',
	DEVELOPMENT: 'Development',
	EDGE_CONTROL: 'Edge control',
	MACHINE_JOBS: 'Machine jobs',
	MACHINE_SANDBOX_CONTROL: 'Machine sandbox control',
	MACHINE_SNAPSHOT_CONTROL: 'Machine snapshot control',
	MACHINE_SETTLEMENT: 'Machine settlement',
	MACHINE_TUNNEL_CONTROL: 'Machine tunnel control',
} as const;

export type OpenApiTag = (typeof OpenApiTag)[keyof typeof OpenApiTag];

export interface OpenApiTagDefinition {
	readonly name: OpenApiTag;
	readonly description: string;
}

export const OPENAPI_TAG_DEFINITIONS = [
	{
		name: OpenApiTag.SANDBOXES,
		description:
			'Create, start, stop, pause, fork, archive and delete sandboxes, and change their runtime settings.',
	},
	{
		name: OpenApiTag.SNAPSHOTS,
		description:
			'Build and manage the images sandboxes start from, including captures of running sandboxes.',
	},
	{
		name: OpenApiTag.VOLUMES,
		description: 'Persistent volumes that outlive the sandboxes mounting them.',
	},
	{
		name: OpenApiTag.EXPOSURES,
		description:
			'Publish sandbox ports through the edge as preview URLs and TCP or UDP endpoints.',
	},
	{
		name: OpenApiTag.CUSTOM_DOMAINS,
		description: 'Serve sandbox exposures from domains your organization owns.',
	},
	{
		name: OpenApiTag.SECRETS,
		description:
			'Encrypted organization secrets injected into sandboxes as environment variables.',
	},
	{
		name: OpenApiTag.REGISTRIES,
		description:
			'Container registries for pulling private images and temporary access for pushing snapshots.',
	},
	{
		name: OpenApiTag.OBJECT_STORAGE,
		description: 'Temporary object storage access for pushing files.',
	},
	{
		name: OpenApiTag.WEBHOOKS,
		description:
			'Endpoints that receive signed event deliveries, and their delivery history.',
	},
	{
		name: OpenApiTag.LISTINGS,
		description:
			'Browse machines offered on the marketplace, their prices and their locations.',
	},
	{
		name: OpenApiTag.MACHINES,
		description:
			'Enroll, list, price and configure the machines you host, and follow their verification.',
	},
	{
		name: OpenApiTag.HOST_PROFILE,
		description: 'The public profile shown to customers on your listings.',
	},
	{
		name: OpenApiTag.ABUSE,
		description:
			'Report abuse on Snapflow-hosted content and appeal decisions on your sandboxes.',
	},
	{
		name: OpenApiTag.ORGANIZATIONS,
		description: 'Organization settings, quota tiers, usage and deletion.',
	},
	{
		name: OpenApiTag.API_KEYS,
		description: 'API keys and the spending budgets attached to them.',
	},
	{
		name: OpenApiTag.USERS,
		description: 'The authenticated user.',
	},
	{
		name: OpenApiTag.AUDIT_LOGS,
		description: 'A record of the actions taken in your organization.',
	},
	{
		name: OpenApiTag.NETWORK_USAGE,
		description: 'Network traffic metered for sandboxes and hosted machines.',
	},
	{
		name: OpenApiTag.BILLING,
		description: 'Prices, balances, usage charges and statements.',
	},
	{
		name: OpenApiTag.SETTLEMENT,
		description:
			'USDC escrow, automatic top-ups, payment channels and the vouchers that settle usage on chain.',
	},
	{
		name: OpenApiTag.WALLETS,
		description: 'Wallets linked to your account for funding and payouts.',
	},
	{
		name: OpenApiTag.USER_WALLET,
		description: 'The passkey wallet Snapflow creates for your account.',
	},
	{
		name: OpenApiTag.PUBLIC_CONFIGURATION,
		description: 'Deployment settings the dashboard loads before sign-in.',
	},
	{
		name: OpenApiTag.HEALTH,
		description: 'Liveness and readiness probes.',
	},
	{
		name: OpenApiTag.ADMIN,
		description: 'Platform administration.',
	},
	{
		name: OpenApiTag.DEVELOPMENT,
		description: 'Local development helpers.',
	},
	{
		name: OpenApiTag.EDGE_CONTROL,
		description: 'Calls edges make to the control plane.',
	},
	{
		name: OpenApiTag.MACHINE_JOBS,
		description: 'The job queue machines poll and report on.',
	},
	{
		name: OpenApiTag.MACHINE_SANDBOX_CONTROL,
		description: 'Sandbox state reported by machines.',
	},
	{
		name: OpenApiTag.MACHINE_SNAPSHOT_CONTROL,
		description: 'Snapshot state reported by machines.',
	},
	{
		name: OpenApiTag.MACHINE_SETTLEMENT,
		description: 'Settlement calls machines make for their hosts.',
	},
	{
		name: OpenApiTag.MACHINE_TUNNEL_CONTROL,
		description: 'Machine tunnels and SSH relays.',
	},
] as const satisfies readonly OpenApiTagDefinition[];
