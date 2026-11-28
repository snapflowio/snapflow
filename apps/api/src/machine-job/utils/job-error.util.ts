/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type ApiErrorBody,
	apiError,
} from '../../common/utils/error/api-error.util';
import { MachineJobApiErrorCode } from '../enums/machine-job-api-error-code.enum';

export const JOB_NOT_OWNED_MESSAGE =
	'This job is assigned to another machine. Drop it and poll for new work.';

export function jobNotFound(jobId?: string): ApiErrorBody {
	return apiError(
		MachineJobApiErrorCode.NOT_FOUND,
		jobId === undefined
			? 'The job was not found. Drop it and poll for new work.'
			: `Job ${jobId} was not found. Drop it and poll for new work.`
	);
}
