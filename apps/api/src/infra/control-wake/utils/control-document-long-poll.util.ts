/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { CONTROL_DOCUMENT_READ } from '../constants/control-wake.constants';
import type { ControlWakeService } from '../services/control-wake.service';

const ETAG_HEADER = 'ETag';
const ETAG_WILDCARD = '*';
const WEAK_ETAG_PREFIX = 'W/';
const ETAG_SEPARATOR = ',';

export const CONTROL_DOCUMENT_WAIT_QUERY = {
	name: 'waitSeconds',
	required: false,
	schema: {
		type: 'integer',
		minimum: CONTROL_DOCUMENT_READ.defaultWaitSeconds,
		maximum: CONTROL_DOCUMENT_READ.maximumWaitSeconds,
		default: CONTROL_DOCUMENT_READ.defaultWaitSeconds,
	},
} as const;

export interface ControlDocument {
	digest: string;
}

export interface ControlDocumentRead<Document extends ControlDocument> {
	wakes: ControlWakeService;
	topic: string;
	subjectId: string;
	ifNoneMatch: string | undefined;
	requestedWaitSeconds: string | undefined;
	unavailableMessage: string;
	build: () => Promise<Document>;
}

export async function sendControlDocument<Document extends ControlDocument>(
	response: Response,
	read: ControlDocumentRead<Document>
): Promise<void> {
	if (read.wakes.isStopping()) {
		sendUnavailable(response, read.unavailableMessage);
		return;
	}
	const wakeVersion = read.wakes.capture(read.topic, read.subjectId);
	let document = await read.build();
	const waitMilliseconds =
		waitSeconds(read.requestedWaitSeconds) *
		CONTROL_DOCUMENT_READ.millisecondsPerSecond;
	if (matchesEtag(read.ifNoneMatch, etag(document)) && waitMilliseconds > 0) {
		await read.wakes.waitForChange(
			read.topic,
			read.subjectId,
			wakeVersion,
			waitMilliseconds
		);
		if (read.wakes.isStopping()) {
			sendUnavailable(response, read.unavailableMessage);
			return;
		}
		document = await read.build();
	}
	const currentEtag = etag(document);
	response.setHeader(ETAG_HEADER, currentEtag);
	response.setHeader('Cache-Control', 'private, no-cache');
	if (matchesEtag(read.ifNoneMatch, currentEtag)) {
		response.status(HttpStatus.NOT_MODIFIED).end();
		return;
	}
	response.status(HttpStatus.OK).json(document);
}

function sendUnavailable(response: Response, message: string): void {
	response.setHeader('Connection', 'close');
	response.setHeader('Retry-After', CONTROL_DOCUMENT_READ.retryAfterSeconds);
	response.status(HttpStatus.SERVICE_UNAVAILABLE).json({ message });
}

function etag(document: ControlDocument): string {
	return `"${document.digest}"`;
}

function waitSeconds(value: string | undefined): number {
	if (value === undefined) return CONTROL_DOCUMENT_READ.defaultWaitSeconds;
	const parsed = Number(value);
	if (!Number.isInteger(parsed)) {
		return CONTROL_DOCUMENT_READ.defaultWaitSeconds;
	}
	return Math.min(
		CONTROL_DOCUMENT_READ.maximumWaitSeconds,
		Math.max(CONTROL_DOCUMENT_READ.defaultWaitSeconds, parsed)
	);
}

function matchesEtag(value: string | undefined, current: string): boolean {
	if (!value) return false;
	return value
		.split(ETAG_SEPARATOR)
		.map((candidate) => candidate.trim())
		.some(
			(candidate) =>
				candidate === ETAG_WILDCARD ||
				candidate === current ||
				candidate === `${WEAK_ETAG_PREFIX}${current}`
		);
}
