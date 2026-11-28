/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

type LineChartTooltipRow = { label: string; value: string; color: string };

export type LineChartTooltipModel = {
	label: string;
	rows: LineChartTooltipRow[];
};

const SHELL_CLASS =
	'grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-surface-3 px-2.5 py-1.5 text-(--text-primary) text-xs shadow-(--shadow-overlay)';
const LABEL_CLASS = 'font-medium text-(--text-primary)';
const BODY_CLASS = 'grid gap-1.5';
const ROW_CLASS = 'flex w-40 items-center gap-2';
const SWATCH_CLASS = 'size-2 shrink-0 rounded-full';
const ROW_TEXT_CLASS =
	'flex flex-1 items-center justify-between gap-x-8 leading-none';
const ROW_LABEL_CLASS = 'capitalize text-(--text-subtle)';
const ROW_VALUE_CLASS =
	'text-(--text-primary) font-mono font-medium tabular-nums';

function element(
	tag: 'div' | 'span',
	className: string,
	text?: string
): HTMLElement {
	const node = document.createElement(tag);
	node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function renderRow(row: LineChartTooltipRow): HTMLElement {
	const swatch = element('div', SWATCH_CLASS);
	swatch.style.background = row.color;
	const text = element('div', ROW_TEXT_CLASS);
	text.append(
		element('span', ROW_LABEL_CLASS, row.label),
		element('span', ROW_VALUE_CLASS, row.value)
	);
	const node = element('div', ROW_CLASS);
	node.append(swatch, text);
	return node;
}

export function renderLineChartTooltip(
	model: LineChartTooltipModel
): HTMLElement {
	const body = element('div', BODY_CLASS);
	body.append(...model.rows.map(renderRow));
	const shell = element('div', SHELL_CLASS);
	shell.append(element('div', LABEL_CLASS, model.label), body);
	return shell;
}
