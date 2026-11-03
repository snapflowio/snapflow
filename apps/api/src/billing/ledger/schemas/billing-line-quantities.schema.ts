/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';

const resourceMillis = z.string().regex(/^\d+(?:\.\d+)?$/);

export const billingLineQuantitiesSchema = z.strictObject({
	vcpuMillis: resourceMillis,
	memoryGibMillis: resourceMillis,
	gpuMillis: resourceMillis,
	runningDiskGibMillis: resourceMillis,
	stoppedDiskGibMillis: resourceMillis,
});

export type BillingLineQuantities = z.infer<typeof billingLineQuantitiesSchema>;
