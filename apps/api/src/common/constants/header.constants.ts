/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const CustomHeaders: {
	[key: string]: {
		name: string;
		description?: string;
		required?: boolean;
		schema?: {
			type?: string;
		};
	};
} = {
	SOURCE: {
		name: 'X-Snapflow-Source',
		description: 'Use to specify the source of the request',
		required: false,
		schema: {
			type: 'string',
		},
	},
	SDK_VERSION: {
		name: 'X-Snapflow-SDK-Version',
		description: 'Use to specify the version of the SDK',
		required: false,
		schema: {
			type: 'string',
		},
	},
	IDEMPOTENCY_KEY: {
		name: 'Idempotency-Key',
		description:
			'Uniquely identifies one logical non-idempotent mutation and is preserved across retries',
		required: true,
		schema: {
			type: 'string',
		},
	},
	DEVELOPMENT_ENROLLMENT_SECRET: {
		name: 'X-Snapflow-Development-Enrollment-Secret',
		description:
			'Shared secret of the local development stack that lets the local machine enroll itself',
		required: true,
		schema: {
			type: 'string',
		},
	},
	IDEMPOTENCY_REPLAYED: {
		name: 'Idempotency-Replayed',
		description:
			'Indicates that the response was replayed from a completed request',
		required: false,
		schema: {
			type: 'boolean',
		},
	},
};
