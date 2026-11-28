/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	IAM_ALLOW_EFFECT,
	IAM_POLICY_VERSION,
	IAM_UPLOAD_ACTIONS,
	S3_OBJECT_ARN_PREFIX,
} from '../constants/object-storage-credential.constants';

export function iamUploadPolicy(
	bucket: string,
	keys: readonly string[]
): string {
	return JSON.stringify({
		Version: IAM_POLICY_VERSION,
		Statement: [
			{
				Effect: IAM_ALLOW_EFFECT,
				Action: IAM_UPLOAD_ACTIONS,
				Resource: keys.map((key) => `${S3_OBJECT_ARN_PREFIX}${bucket}/${key}`),
			},
		],
	});
}
