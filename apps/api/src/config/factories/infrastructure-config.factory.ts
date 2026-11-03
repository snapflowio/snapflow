/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ObjectStorageProvider } from '../enums/object-storage-provider.enum';
import type { databaseEnvironment } from '../environment/namespaces/database.environment';
import { LOG_LEVELS } from '../environment/namespaces/observability.environment';
import type { ParsedEnvironment } from '../environment/utils/read-environment.util';
import type { ConfigurationInput } from '../types/configuration-input.types';
import { parseVaultProxyUrl } from '../utils/vault-proxy-url.util';

const POOL_MINIMUM_CONNECTIONS = 0;
const SSL_MODE_PARAMETER = 'sslmode';
const HOSTED_SSL_MODE = 'verify-full';

export function createDatabaseConfig(
	{ values, profile }: ParsedEnvironment<typeof databaseEnvironment>,
	poolMax: number
) {
	if (
		profile.hosted &&
		new URL(values.DATABASE_URL).searchParams.get(SSL_MODE_PARAMETER) !==
			HOSTED_SSL_MODE
	) {
		throw new Error(
			`DATABASE_URL must set ${SSL_MODE_PARAMETER}=${HOSTED_SSL_MODE} in ${profile.name}`
		);
	}
	return {
		url: values.DATABASE_URL,
		logging:
			LOG_LEVELS.indexOf(values.LOG_LEVEL) <=
			LOG_LEVELS.indexOf(values.SQL_LOG_LEVEL),
		driverOptions: {
			connectionString: values.DATABASE_URL,
			connectionTimeoutMillis: values.DATABASE_CONNECTION_TIMEOUT_MS,
		},
		pool: {
			max: poolMax,
			min: POOL_MINIMUM_CONNECTIONS,
			idleTimeoutMillis: values.DATABASE_POOL_IDLE_TIMEOUT_MS,
		},
	};
}

type ObjectStorageLocation = Pick<
	ConfigurationInput['values'],
	'S3_ENDPOINT' | 'S3_REGION'
>;

const awsS3Endpoint = (region: string): string =>
	`https://s3.${region}.amazonaws.com`;

const OBJECT_STORAGE_ENDPOINT: Readonly<
	Record<
		ObjectStorageProvider,
		(location: ObjectStorageLocation) => string | undefined
	>
> = {
	[ObjectStorageProvider.S3_COMPATIBLE]: (location) => location.S3_ENDPOINT,
	[ObjectStorageProvider.AWS]: (location) =>
		location.S3_REGION ? awsS3Endpoint(location.S3_REGION) : undefined,
};

function selectObjectStorageProvider(
	values: ConfigurationInput['values']
): ObjectStorageProvider {
	if (!values.S3_ENDPOINT) {
		if (values.S3_REGION && !values.S3_ROLE_ARN) {
			throw new Error('S3_ROLE_ARN is required for AWS S3 object storage');
		}
		return ObjectStorageProvider.AWS;
	}
	if (values.S3_ROLE_ARN) {
		throw new Error('S3_ROLE_ARN is not allowed when S3_ENDPOINT is set');
	}
	if (!values.S3_ACCESS_KEY) {
		throw new Error(
			'S3_ACCESS_KEY and S3_SECRET_KEY are required when S3_ENDPOINT is set'
		);
	}
	return ObjectStorageProvider.S3_COMPATIBLE;
}

function createEmailConfig(values: ConfigurationInput['values']) {
	if (!values.RESEND_API_KEY) return undefined;
	if (!values.EMAIL_FROM || !values.WEBSITE_URL) {
		throw new Error(
			'EMAIL_FROM and WEBSITE_URL are required when RESEND_API_KEY is set'
		);
	}
	return {
		resendApiKey: values.RESEND_API_KEY,
		resendBaseUrl: values.RESEND_BASE_URL,
		from: values.EMAIL_FROM,
		replyTo: values.EMAIL_REPLY_TO,
		websiteUrl: values.WEBSITE_URL,
	};
}

export function createInfrastructureConfig(input: ConfigurationInput) {
	const { values, profile } = input;
	if (Boolean(values.S3_ACCESS_KEY) !== Boolean(values.S3_SECRET_KEY)) {
		throw new Error('S3_ACCESS_KEY and S3_SECRET_KEY must be set together');
	}
	parseVaultProxyUrl(values.SNAPFLOW_VAULT_PROXY_URL, profile.hosted);
	const objectStorageProvider = selectObjectStorageProvider(values);
	return {
		database: createDatabaseConfig(input, values.DATABASE_POOL_MAX),
		redis: { url: values.REDIS_URL },
		email: createEmailConfig(values),
		s3: {
			endpoint: OBJECT_STORAGE_ENDPOINT[objectStorageProvider](values),
			region: values.S3_REGION,
			accessKey: values.S3_ACCESS_KEY,
			secretKey: values.S3_SECRET_KEY,
			defaultBucket: values.S3_DEFAULT_BUCKET,
			provider: objectStorageProvider,
			roleArn: values.S3_ROLE_ARN,
		},
		volumeBackup: {
			intervalSeconds: values.SNAPFLOW_VOLUME_BACKUP_INTERVAL_SECONDS,
		},
		snapshotManager: {
			url: values.SNAPFLOW_SNAPSHOT_MANAGER_URL,
		},
		geoIp: { databasePath: values.SNAPFLOW_GEOIP_DATABASE_PATH },
		vault: { proxyUrl: values.SNAPFLOW_VAULT_PROXY_URL },
		cloudflareIngress: {
			apiToken: values.SNAPFLOW_CLOUDFLARE_API_TOKEN,
			webhookSecret: values.SNAPFLOW_CLOUDFLARE_WEBHOOK_SECRET,
		},
	};
}
