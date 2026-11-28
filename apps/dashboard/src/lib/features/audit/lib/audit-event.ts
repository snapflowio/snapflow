/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AuditLog } from '@snapflow/api-client';

const CLIENT_ERROR_STATUS = 400;
const WORD_SEPARATOR = /_/g;
const ACTION_WORD_SEPARATOR = '_';
const SDK_SOURCE_PREFIX = 'sdk';
const KEY_GLYPH = 'K';
const SYSTEM_GLYPH = '⚙';
const UNKNOWN_ACTOR = 'Unknown';

const ACTOR_TYPE = {
	HUMAN: 'human',
	MACHINE: 'machine',
	EDGE: 'edge',
	HEALTH_CHECK: 'health_check',
	SYSTEM: 'system',
} as const;

const CREDENTIAL_TYPE = {
	SESSION: 'session',
	API_KEY: 'api_key',
} as const;

export const AUDIT_CATEGORIES = [
	'sandbox',
	'snapshot',
	'volume',
	'registry',
	'machine',
	'secret',
	'api_key',
	'organization',
	'billing',
	'webhook',
	'abuse',
	'other',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
	sandbox: 'Sandboxes',
	snapshot: 'Snapshots',
	volume: 'Volumes',
	registry: 'Registries',
	machine: 'Machines',
	secret: 'Secrets',
	api_key: 'API keys',
	organization: 'Organization',
	billing: 'Billing',
	webhook: 'Webhooks',
	abuse: 'Abuse',
	other: 'Other',
};

const TARGET_CATEGORY: Readonly<Record<string, AuditCategory>> = {
	sandbox: 'sandbox',
	snapshot: 'snapshot',
	volume: 'volume',
	docker_registry: 'registry',
	machine: 'machine',
	price_suggestion: 'machine',
	secret: 'secret',
	api_key: 'api_key',
	organization: 'organization',
	user: 'organization',
	settings: 'organization',
	billing: 'billing',
	payment_wallet: 'billing',
	payment_channel: 'billing',
	webhook_endpoint: 'webhook',
	webhook_delivery: 'webhook',
	abuse_case: 'abuse',
	abuse_report: 'abuse',
};

const TARGET_NOUN: Readonly<Record<string, string>> = {
	docker_registry: 'registry',
	price_suggestion: 'price suggestion',
	payment_wallet: 'payment wallet',
	payment_channel: 'payment channel',
	api_key: 'API key',
	webhook_endpoint: 'webhook endpoint',
	webhook_delivery: 'webhook delivery',
	abuse_case: 'abuse case',
	abuse_report: 'abuse report',
};

const ACTION_VERB: Readonly<Record<string, string>> = {
	create: 'Created',
	update: 'Updated',
	delete: 'Deleted',
	export: 'Exported',
	start: 'Started',
	stop: 'Stopped',
	resize: 'Resized',
	archive: 'Archived',
	snapshot: 'Snapshotted',
	fork: 'Forked',
	pause: 'Paused',
	activate: 'Activated',
	deactivate: 'Deactivated',
	recover: 'Recovered',
	register: 'Registered',
	suspend: 'Suspended',
	unsuspend: 'Unsuspended',
	impersonate: 'Impersonated',
	rotate_secret: 'Rotated the secret of',
	send_test: 'Sent a test to',
	resend: 'Resent',
	replace_labels: 'Replaced labels on',
	create_backup: 'Backed up',
	create_ssh_access: 'Opened SSH access to',
	revoke_ssh_access: 'Revoked SSH access to',
};

export const AUDIT_VIAS = [
	'dashboard',
	'api_key',
	'sdk',
	'machine',
	'system',
] as const;

export type AuditVia = (typeof AUDIT_VIAS)[number];

export const AUDIT_VIA_LABEL: Record<AuditVia, string> = {
	dashboard: 'Dashboard',
	api_key: 'API key',
	sdk: 'SDK',
	machine: 'Machine',
	system: 'System',
};

function sentenceCase(value: string): string {
	const words = value.replace(WORD_SEPARATOR, ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function auditUnknownLabel(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object') {
		const entries = Object.values(value).filter(
			(entry) => typeof entry === 'string'
		);
		return entries.length > 0 ? entries.join(', ') : undefined;
	}
	return undefined;
}

export function auditCategory(event: AuditLog): AuditCategory {
	return TARGET_CATEGORY[event.targetType ?? ''] ?? 'other';
}

function targetNoun(targetType: string | undefined): string | null {
	if (!targetType) return null;
	return TARGET_NOUN[targetType] ?? targetType.replace(WORD_SEPARATOR, ' ');
}

export function auditActionLabel(event: AuditLog): string {
	const noun = targetNoun(event.targetType);
	const verb = ACTION_VERB[event.action];
	if (verb && noun) return `${verb} ${noun}`;
	const [head = '', ...rest] = event.action.split(ACTION_WORD_SEPARATOR);
	const headVerb = ACTION_VERB[head];
	if (headVerb && noun && rest.length > 0) {
		return `${headVerb} ${noun} ${rest.join(' ')}`;
	}
	if (noun) return `${sentenceCase(event.action)} · ${noun}`;
	return sentenceCase(event.action);
}

export function auditFailed(event: AuditLog): boolean {
	return (
		event.statusCode !== undefined && event.statusCode >= CLIENT_ERROR_STATUS
	);
}

export function auditVia(event: AuditLog): AuditVia {
	const actorType = auditUnknownLabel(event.actorType);
	const credentialType = auditUnknownLabel(event.credentialType);
	if (actorType === ACTOR_TYPE.SYSTEM) return 'system';
	if (actorType !== ACTOR_TYPE.HUMAN) return 'machine';
	if (event.source?.startsWith(SDK_SOURCE_PREFIX)) return 'sdk';
	if (credentialType === CREDENTIAL_TYPE.API_KEY) return 'api_key';
	return 'dashboard';
}

export function auditActorLabel(event: AuditLog): string {
	return (
		event.actorDisplayName ??
		event.actorEmail ??
		(auditVia(event) === 'system' ? AUDIT_VIA_LABEL.system : UNKNOWN_ACTOR)
	);
}

export function auditActorGlyph(event: AuditLog): string {
	const via = auditVia(event);
	if (via === 'system' || via === 'machine') return SYSTEM_GLYPH;
	if (via === 'api_key' || via === 'sdk') return KEY_GLYPH;
	return auditActorLabel(event);
}

export function auditActorIds(event: AuditLog): string[] {
	return [event.actorId, event.credentialId, event.userId].filter(
		(id): id is string => Boolean(id)
	);
}

export function matchesAuditSearch(event: AuditLog, search: string): boolean {
	return (
		!search ||
		event.action.toLowerCase().includes(search) ||
		auditActionLabel(event).toLowerCase().includes(search) ||
		(event.actorEmail?.toLowerCase().includes(search) ?? false) ||
		(event.actorDisplayName?.toLowerCase().includes(search) ?? false) ||
		(event.actorId?.toLowerCase().includes(search) ?? false) ||
		(event.targetType?.toLowerCase().includes(search) ?? false) ||
		(event.targetId?.toLowerCase().includes(search) ?? false) ||
		(event.errorMessage?.toLowerCase().includes(search) ?? false)
	);
}
