/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AbuseSignalKind } from './abuse.constants';
import { AbuseReportCategory } from './abuse-report.constants';

export const ABUSE_SIGNAL_LABEL = {
	[AbuseSignalKind.MINING_POOL_DNS]: 'lookups of cryptocurrency mining pools',
	[AbuseSignalKind.MINING_POOL_CONNECTION]:
		'connections to cryptocurrency mining pools',
	[AbuseSignalKind.STRATUM_HANDSHAKE]: 'a cryptocurrency mining handshake',
	[AbuseSignalKind.MINING_PROFILE]: 'a cryptocurrency mining traffic pattern',
	[AbuseSignalKind.HORIZONTAL_SCAN]: 'scanning many addresses',
	[AbuseSignalKind.VERTICAL_SCAN]: 'scanning many ports on one address',
	[AbuseSignalKind.FAILED_CONNECTIONS]: 'mostly failing connections',
	[AbuseSignalKind.BRUTE_FORCE]: 'repeated login attempts against a server',
	[AbuseSignalKind.SMTP_ATTEMPTS]: 'sending mail directly',
	[AbuseSignalKind.CONNECTION_FLOOD]: 'a flood of new connections',
	[AbuseSignalKind.PACKET_FLOOD]: 'a packet flood',
	[AbuseSignalKind.REFLECTION_ATTEMPTS]: 'traffic used in reflection attacks',
	[AbuseSignalKind.PROXY_RELAY]: 'relaying traffic as a proxy',
} as const satisfies Record<AbuseSignalKind, string>;

export const ABUSE_CATEGORY_LABEL = {
	[AbuseReportCategory.PHISHING]: 'phishing',
	[AbuseReportCategory.MALWARE]: 'distributing malware',
	[AbuseReportCategory.CSAM]: 'prohibited content',
	[AbuseReportCategory.NON_CONSENSUAL_IMAGERY]:
		'non-consensual intimate imagery',
	[AbuseReportCategory.COPYRIGHT]: 'copyright infringement',
	[AbuseReportCategory.TRADEMARK]: 'trademark infringement',
	[AbuseReportCategory.NETWORK_ABUSE]: 'network abuse',
	[AbuseReportCategory.THREAT_TO_LIFE]: "a threat to someone's life or safety",
	[AbuseReportCategory.OTHER]: 'breaking the acceptable use policy',
} as const satisfies Record<AbuseReportCategory, string>;
