/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { UnderscoreNamingStrategy } from '@mikro-orm/core';

const CONSTRAINT_SUFFIX = {
	foreign: 'fk',
	index: 'index',
	primary: 'pk',
	unique: 'unique',
} as const;

const PRIMARY_KEY_CONSTRAINT_NAMES = new Map([
	['api_idempotency_record', 'PK_api_idempotency_record'],
	['billing_budget', 'billing_budget_pkey'],
	['billing_budget_version', 'billing_budget_version_pkey'],
	['billing_ledger_entry', 'PK_billing_ledger_entry'],
	['billing_line_quarantine', 'PK_billing_line_quarantine'],
	['billing_ledger_account', 'PK_billing_ledger_account'],
	['billing_ledger_transaction', 'PK_billing_ledger_transaction'],
	['billing_line_adjustment', 'billing_line_adjustment_pkey'],
	['billing_line_item', 'billing_line_item_pkey'],
	['build_info', 'build_info_snapshotRef_pk'],
	['edge_usage_checkpoint', 'PK_edge_usage_checkpoint'],
	['network_edge', 'PK_network_edge'],
	['network_edge_session', 'PK_network_edge_session'],
	['network_usage_period', 'PK_network_usage_period'],
	['network_budget_alert', 'PK_network_budget_alert'],
	['exposure_network_usage', 'PK_exposure_network_usage'],
	['secret_delivery_event', 'PK_secret_delivery_event'],
	['machine', 'machine_id_pk'],
	['machine_edge_binding', 'PK_machine_edge_binding'],
	['machine_assessment', 'PK_machine_assessment'],
	['machine_observation', 'PK_machine_observation'],
	['machine_session', 'PK_machine_session'],
	['machine_usage_receipt', 'PK_machine_usage_receipt'],
	['sandbox', 'sandbox_id_pk'],
	['sandbox_custom_domain', 'PK_sandbox_custom_domain'],
	['sandbox_billable_usage', 'PK_sandbox_billable_usage'],
	['sandbox_fork', 'sandbox_fork_id_pk'],
	['sandbox_secret_binding_set', 'PK_sandbox_secret_binding_set'],
	['sandbox_secret_binding', 'PK_sandbox_secret_binding'],
	['sandbox_exposure', 'PK_sandbox_exposure'],
	['sandbox_exposure_backend', 'PK_sandbox_exposure_backend'],
	['sandbox_exposure_reconciliation', 'PK_exposure_reconciliation'],
	['snapshot', 'snapshot_id_pk'],
	['snapshot_region', 'snapshot_region_snapshotId_regionId_pk'],
	['ssh_access', 'ssh_access_id_pk'],
	['sandbox_last_activity', 'sandbox_last_activity_sandboxId_pk'],
	['sandbox_placement', 'PK_sandbox_placement'],
	['sandbox_observed_status', 'PK_sandbox_observed_status'],
	['placement_billing_authorization', 'placement_billing_authorization_pkey'],
	['sandbox_usage_periods', 'sandbox_usage_periods_id_pk'],
	['sandbox_usage_periods_archive', 'sandbox_usage_periods_archive_id_pk'],
	['machine_qualification_challenge', 'PK_machine_qualification_challenge'],
	['machine_qualification_evidence', 'PK_machine_qualification_evidence'],
	['machine_reliability_event', 'PK_machine_reliability_event'],
	['machine_workload_outcome', 'PK_machine_workload_outcome'],
	['secret', 'PK_secret'],
	['secret_version', 'PK_secret_version'],
	['volume_backup', 'PK_volume_backup_artifact'],
]);

export class MikroOrmNamingStrategy extends UnderscoreNamingStrategy {
	override indexName(
		tableName: string,
		columns: string[],
		type:
			| 'primary'
			| 'foreign'
			| 'unique'
			| 'index'
			| 'sequence'
			| 'check'
			| 'default'
			| 'trigger'
	): string {
		if (type === 'primary') {
			const existingConstraintName =
				PRIMARY_KEY_CONSTRAINT_NAMES.get(tableName);

			if (existingConstraintName) {
				return existingConstraintName;
			}
		}

		if (type in CONSTRAINT_SUFFIX) {
			return `${tableName}_${columns.join('_')}_${CONSTRAINT_SUFFIX[type as keyof typeof CONSTRAINT_SUFFIX]}`;
		}

		return super.indexName(tableName, columns, type);
	}
}
