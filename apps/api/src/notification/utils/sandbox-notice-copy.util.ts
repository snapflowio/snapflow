/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { BackupState } from '../../volume/enums/backup-state.enum';
import { DASHBOARD_NOTICE_PATH } from '../constants/notice.constants';
import type { NoticeAction, NoticeCopy } from '../types/notice.types';
import { NOTICE_DATE_FORMAT } from './notice-format.util';

const SANDBOX_LIST_SEPARATOR = ', ';
const MAXIMUM_LISTED_SANDBOXES = 5;

type UnavailableSandbox = Pick<
	Sandbox,
	'id' | 'name' | 'backupState' | 'lastBackupAt'
>;

export interface MachineUnavailableNotice {
	unavailableSince: Date;
	sandboxes: readonly [UnavailableSandbox, ...UnavailableSandbox[]];
}

function sandboxList(sandboxes: readonly UnavailableSandbox[]): string {
	const listed = sandboxes
		.slice(0, MAXIMUM_LISTED_SANDBOXES)
		.map((sandbox) => sandbox.name)
		.join(SANDBOX_LIST_SEPARATOR);
	const unlisted = sandboxes.length - MAXIMUM_LISTED_SANDBOXES;
	return unlisted > 0 ? `${listed} and ${unlisted} more` : listed;
}

function backupLine(sandbox: UnavailableSandbox): string {
	return sandbox.backupState === BackupState.COMPLETED && sandbox.lastBackupAt
		? `${sandbox.name}: last backed up ${NOTICE_DATE_FORMAT.format(sandbox.lastBackupAt)}.`
		: `${sandbox.name}: no backup since it last started.`;
}

function viewAction(
	sandboxes: MachineUnavailableNotice['sandboxes']
): NoticeAction {
	const [first, ...rest] = sandboxes;
	return rest.length === 0
		? {
				label: 'View sandbox',
				path: `${DASHBOARD_NOTICE_PATH.SANDBOXES}/${encodeURIComponent(first.id)}`,
			}
		: { label: 'View sandboxes', path: DASHBOARD_NOTICE_PATH.SANDBOXES };
}

export function machineUnavailableNoticeCopy({
	unavailableSince,
	sandboxes,
}: MachineUnavailableNotice): NoticeCopy {
	const [first, ...rest] = sandboxes;
	const single = rest.length === 0;
	const subject = single
		? `${first.name} is unavailable`
		: `${sandboxes.length} sandboxes are unavailable`;
	const subjectPronoun = single ? 'It is' : 'They are';
	const objectPronoun = single ? 'it' : 'they';
	return {
		subject,
		heading: subject,
		paragraphs: [
			`The machine running ${sandboxList(sandboxes)} stopped responding at ${NOTICE_DATE_FORMAT.format(unavailableSince)}. ${subjectPronoun} marked "Machine unavailable", not billed while the machine is offline, and no longer counted toward your limits.`,
			`If the machine comes back, ${single ? 'the sandbox resumes' : 'the sandboxes resume'} where ${objectPronoun} left off. If it does not, work since the last backup is lost.`,
			...sandboxes.slice(0, MAXIMUM_LISTED_SANDBOXES).map(backupLine),
		],
		note: 'You can delete an unavailable sandbox at any time and create a replacement. The host who runs the machine has been told it is offline.',
		action: viewAction(sandboxes),
	};
}
