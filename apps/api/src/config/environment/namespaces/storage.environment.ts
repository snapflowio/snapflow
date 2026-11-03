/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { PRODUCTION_ONLY } from '../../constants/deployment-environment.constants';
import { DEFAULT_VOLUME_BACKUP_INTERVAL_SECONDS } from '../../constants/volume-backup-environment.constants';
import {
	httpUrlText,
	iamRoleArnText,
	positiveIntegerText,
	text,
} from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const objectStorageEnvironment = defineEnvironment(
	{
		name: 'object-storage',
		title: 'Object Storage',
		description:
			'S3-compatible object storage for build contexts, logs and backups',
	},
	{
		S3_ENDPOINT: environmentVariable(httpUrlText().optional(), {
			description:
				'Endpoint of a self-hosted S3-compatible object storage with STS AssumeRole support; setting it selects that provider and requires S3_ACCESS_KEY and S3_SECRET_KEY, and without it the AWS S3 endpoint is derived from S3_REGION.',
		}),
		S3_REGION: environmentVariable(text().optional(), {
			description:
				'S3 signing region; without S3_ENDPOINT it selects the AWS S3 endpoint.',
			requiredIn: PRODUCTION_ONLY,
		}),
		S3_DEFAULT_BUCKET: environmentVariable(text().optional(), {
			description: 'Bucket of platform objects.',
			requiredIn: PRODUCTION_ONLY,
		}),
		S3_ACCESS_KEY: environmentVariable(text().optional(), {
			description:
				'Static S3 access key, set with S3_SECRET_KEY; required with S3_ENDPOINT, otherwise the AWS default credential chain applies.',
			secret: true,
		}),
		S3_SECRET_KEY: environmentVariable(text().optional(), {
			description: 'Static S3 secret key.',
			secret: true,
		}),
		S3_ROLE_ARN: environmentVariable(iamRoleArnText().optional(), {
			description:
				'IAM role AWS STS assumes to issue push credentials scoped to an organization; required for AWS S3 and not allowed with S3_ENDPOINT.',
		}),
		SNAPFLOW_VOLUME_BACKUP_INTERVAL_SECONDS: environmentVariable(
			positiveIntegerText().prefault(
				String(DEFAULT_VOLUME_BACKUP_INTERVAL_SECONDS)
			),
			{
				description:
					'Seconds between incremental backups of the volumes of a running sandbox; a host failure loses at most this much volume data.',
			}
		),
	}
);
