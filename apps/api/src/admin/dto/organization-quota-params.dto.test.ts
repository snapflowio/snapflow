/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { OrganizationQuotaParamsDto } from './organization-quota-params.dto';

const pipe = new ValidationPipe({
	forbidNonWhitelisted: true,
	forbidUnknownValues: true,
	transform: true,
	whitelist: true,
});
const PARAMS = { type: 'param', metatype: OrganizationQuotaParamsDto } as const;

describe('OrganizationQuotaParamsDto', () => {
	it('passes a known sandbox class through the global validation pipe', async () => {
		const params = {
			organizationId: 'organization',
			sandboxClass: SandboxClass.LINUX_VM,
		};
		assert.deepEqual({ ...(await pipe.transform(params, PARAMS)) }, params);
	});

	it('refuses an unknown sandbox class', async () => {
		await assert.rejects(
			pipe.transform(
				{ organizationId: 'organization', sandboxClass: 'x' },
				PARAMS
			),
			BadRequestException
		);
	});
});
