/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { StreamableFile } from '@nestjs/common';
import { DATA_EXPORT } from '../constants/data-export.constants';

export function jsonDownload(data: unknown, filename: string): StreamableFile {
	return new StreamableFile(
		Buffer.from(JSON.stringify(data, null, DATA_EXPORT.INDENTATION)),
		{
			type: DATA_EXPORT.CONTENT_TYPE,
			disposition: `attachment; filename="${filename}"`,
		}
	);
}
