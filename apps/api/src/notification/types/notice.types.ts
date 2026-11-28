/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export interface NoticeAction {
	label: string;
	path: string;
	search?: Readonly<Record<string, string>>;
}

export interface NoticeCopy {
	subject: string;
	heading: string;
	paragraphs: string[];
	note: string;
	action: NoticeAction;
}
