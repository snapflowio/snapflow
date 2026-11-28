/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { STATUS_CODES } from 'node:http';
import {
	COMMON_ERROR_MESSAGES,
	STATUS_ERROR_CODES,
} from '../../constants/api-error-code.constants';
import type { ApiErrorDto } from '../../dto/api-error.dto';
import { CommonErrorCode } from '../../enums/common-error-code.enum';

const MESSAGE_SEPARATOR = ', ';
const FALLBACK_REASON_PHRASE = 'HTTP Error';
const RAW_FRAMEWORK_MESSAGE_PATTERN = /^[A-Za-z]+Exception\b/;

export interface NormalizedHttpExceptionResponse {
	details: Record<string, unknown>;
	message: string;
}

export interface NormalizedErrorResponse
	extends NormalizedHttpExceptionResponse {
	code: string;
}

export function normalizeHttpExceptionResponse(
	response: string | object,
	fallbackMessage: string
): NormalizedHttpExceptionResponse {
	if (typeof response === 'string') {
		return { details: {}, message: response };
	}
	const details = isRecord(response) ? response : {};
	const message =
		responseMessage(details.message) ??
		(domainErrorMessage(details.code) || fallbackMessage);
	return { details, message };
}

export function normalizeErrorResponse(
	response: string | object,
	fallbackMessage: string,
	statusCode: number
): NormalizedErrorResponse {
	const body =
		typeof response === 'string' || !isRecord(response) ? {} : response;
	const details = Array.isArray(body.message)
		? { ...body, errors: body.message.filter(isString) }
		: body;
	const explicitCode = errorCode(details.code);
	const code = explicitCode ?? fallbackErrorCode(statusCode, details.message);
	const candidate =
		typeof response === 'string'
			? response
			: (responseMessage(details.message) ??
				(explicitCode ? domainErrorMessage(explicitCode) : fallbackMessage));
	const message =
		explicitCode === undefined && isBareMessage(candidate, statusCode)
			? COMMON_ERROR_MESSAGES[fallbackErrorCode(statusCode, undefined)]
			: candidate;
	return { details, code, message };
}

export function apiErrorBody(
	path: string,
	statusCode: number,
	normalized: NormalizedErrorResponse
): ApiErrorDto {
	return {
		...normalized.details,
		path,
		timestamp: new Date().toISOString(),
		statusCode,
		error: STATUS_CODES[statusCode] ?? FALLBACK_REASON_PHRASE,
		code: normalized.code,
		message: normalized.message,
	};
}

function fallbackErrorCode(
	statusCode: number,
	message: unknown
): CommonErrorCode {
	if (Array.isArray(message)) return CommonErrorCode.VALIDATION_FAILED;
	return STATUS_ERROR_CODES[statusCode] ?? CommonErrorCode.REQUEST_FAILED;
}

function isBareMessage(message: string, statusCode: number): boolean {
	const trimmed = message.trim();
	return (
		trimmed.length === 0 ||
		trimmed === STATUS_CODES[statusCode] ||
		RAW_FRAMEWORK_MESSAGE_PATTERN.test(trimmed)
	);
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function errorCode(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function responseMessage(value: unknown): string | null {
	if (Array.isArray(value)) return value.join(MESSAGE_SEPARATOR);
	return typeof value === 'string' ? value : null;
}

function domainErrorMessage(code: unknown): string {
	if (typeof code !== 'string' || code.length === 0) return '';
	const words = code.replaceAll('_', ' ');
	return `${words[0].toUpperCase()}${words.slice(1)}`;
}

function isRecord(value: object): value is Record<string, unknown> {
	return !Array.isArray(value);
}
