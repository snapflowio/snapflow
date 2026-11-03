/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Element, ElementContent } from 'hast';

const SAFE_PROTOCOL = /^(https?|ircs?|mailto|xmpp)$/i;
const URL_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
	href: ['a'],
	src: ['img'],
};
const TABLE_ELEMENTS: ReadonlySet<string> = new Set([
	'table',
	'tbody',
	'thead',
	'tfoot',
	'tr',
]);
const TABLE_CELL_ELEMENTS: ReadonlySet<string> = new Set(['td', 'th']);
const ALIGN_PROPERTY = 'align';
const SRC_PROPERTY = 'src';
const STYLE_PROPERTY = 'style';
const CLASS_NAME_PROPERTY = 'className';
const ARIA_PREFIX = 'aria';
const DATA_PREFIX = 'data';
const UPPERCASE_LETTER = /[A-Z]/g;
const INTER_ELEMENT_WHITESPACE = /^[ \t\n\f\r]*$/;
const CODE_LANGUAGE_CLASS = /language-([\w-]+)/;
const TRAILING_NEWLINE = /\n$/;
const LIST_SEPARATOR = ' ';

function transformUrl(value: string): string {
	const colon = value.indexOf(':');
	const questionMark = value.indexOf('?');
	const numberSign = value.indexOf('#');
	const slash = value.indexOf('/');
	if (
		colon === -1 ||
		(slash !== -1 && colon > slash) ||
		(questionMark !== -1 && colon > questionMark) ||
		(numberSign !== -1 && colon > numberSign) ||
		SAFE_PROTOCOL.test(value.slice(0, colon))
	) {
		return value;
	}
	return '';
}

function attributeName(property: string): string {
	if (property === CLASS_NAME_PROPERTY) return 'class';
	if (property.startsWith(ARIA_PREFIX)) {
		return `${ARIA_PREFIX}-${property.slice(ARIA_PREFIX.length).toLowerCase()}`;
	}
	if (property.startsWith(DATA_PREFIX)) {
		return `${DATA_PREFIX}${property
			.slice(DATA_PREFIX.length)
			.replace(UPPERCASE_LETTER, (letter) => `-${letter.toLowerCase()}`)}`;
	}
	return property.toLowerCase();
}

function attributeValue(element: Element, property: string, value: unknown) {
	const joined = Array.isArray(value) ? value.join(LIST_SEPARATOR) : value;
	if (!URL_PROPERTIES[property]?.includes(element.tagName)) return joined;
	const url = transformUrl(String(joined ?? ''));
	return property === SRC_PROPERTY && url === '' ? undefined : url;
}

export function elementAttributes(element: Element): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(element.properties)
			.filter(
				([property]) =>
					property !== STYLE_PROPERTY &&
					!(
						property === ALIGN_PROPERTY &&
						TABLE_CELL_ELEMENTS.has(element.tagName)
					)
			)
			.map(([property, value]) => [
				attributeName(property),
				attributeValue(element, property, value),
			])
	);
}

export function elementStyle(element: Element): string | undefined {
	const style = element.properties[STYLE_PROPERTY];
	return typeof style === 'string' ? style : undefined;
}

export function cellTextAlign(element: Element): string | undefined {
	const align = element.properties[ALIGN_PROPERTY];
	return TABLE_CELL_ELEMENTS.has(element.tagName) && typeof align === 'string'
		? align
		: undefined;
}

export function renderedChildren(element: Element): ElementContent[] {
	if (!TABLE_ELEMENTS.has(element.tagName)) return element.children;
	return element.children.filter(
		(child) =>
			child.type !== 'text' || !INTER_ELEMENT_WHITESPACE.test(child.value)
	);
}

function textContent(element: Element): string {
	return element.children
		.map((child) => (child.type === 'text' ? child.value : ''))
		.join('');
}

export function codeBlock(
	element: Element
): { code: string; language: string } | null {
	const className = element.properties[CLASS_NAME_PROPERTY];
	const classes = Array.isArray(className)
		? className.join(LIST_SEPARATOR)
		: String(className ?? '');
	const language = CODE_LANGUAGE_CLASS.exec(classes)?.[1];
	if (!language) return null;
	return {
		code: textContent(element).replace(TRAILING_NEWLINE, ''),
		language,
	};
}

export function linkHref(element: Element): string | undefined {
	const href = elementAttributes(element)['href'];
	return typeof href === 'string' ? href : undefined;
}
