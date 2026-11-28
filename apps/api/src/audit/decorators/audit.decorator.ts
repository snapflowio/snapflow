/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditTarget } from '../enums/audit-target.enum';

export type TypedRequest<T> = Omit<Request, 'body'> & { body: T };

export const MASKED_AUDIT_VALUE = '********';

type AuditTargetIdentifier = string | readonly string[] | null | undefined;

export interface AuditContext<Result = unknown> {
	action: AuditAction;
	targetType?: AuditTarget;
	targetIdFromRequest?: (req: Request) => AuditTargetIdentifier;
	targetIdFromResult?: (result: Result) => AuditTargetIdentifier;
	requestMetadata?: Record<string, (req: Request) => unknown>;
	resultMetadata?: Record<string, (result: Result) => unknown>;
}

export const AUDIT_CONTEXT_KEY = 'audit_context';

export const Audit = <Result>(context: AuditContext<Result>) =>
	SetMetadata(AUDIT_CONTEXT_KEY, context);
