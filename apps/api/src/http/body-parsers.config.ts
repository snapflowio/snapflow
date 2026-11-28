/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { NestExpressApplication } from '@nestjs/platform-express';
import { type Express, json } from 'express';
import { CONNECTION_REPORT_ROUTE } from '../abuse/constants/isp-complaint.constants';
import { API_GLOBAL_PREFIX } from '../common/constants/api-path.constants';
import {
	JOB_CONTROLLER_PATH,
	JOB_STATUS_REQUEST_BODY_LIMIT,
	JOB_STATUS_ROUTE,
} from '../machine-job/constants/job-execution.constants';

const REQUEST_BODY_LIMIT = '100kb';

const JOB_STATUS_PATH = `/${API_GLOBAL_PREFIX}/${JOB_CONTROLLER_PATH}/${JOB_STATUS_ROUTE}`;

const CONNECTION_REPORT_PATH = `/${API_GLOBAL_PREFIX}/${CONNECTION_REPORT_ROUTE.controller}/${CONNECTION_REPORT_ROUTE.path}`;

export function configureBodyParsers(app: NestExpressApplication): void {
	const server: Express = app.getHttpAdapter().getInstance();
	server.post(JOB_STATUS_PATH, json({ limit: JOB_STATUS_REQUEST_BODY_LIMIT }));
	server.put(
		CONNECTION_REPORT_PATH,
		json({ limit: CONNECTION_REPORT_ROUTE.requestBodyLimit })
	);
	app.useBodyParser('json', { limit: REQUEST_BODY_LIMIT });
	app.useBodyParser('urlencoded', {
		limit: REQUEST_BODY_LIMIT,
		extended: true,
	});
}
