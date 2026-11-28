/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Address, isAddress } from 'viem';
import {
	SANCTIONED_CURRENCY_SEPARATOR,
	SDN_DIGITAL_CURRENCY_ID_TYPE_PREFIX,
	SDN_NAME_SEPARATOR,
	SDN_UID_PATTERN,
	SDN_XML_ELEMENT,
} from '../../constants/sanctions.constants';
import type { SdnAddress } from '../../types/sanctions.types';

interface CurrencyAddress {
	readonly currency: string;
	readonly address: Address;
}

interface SdnEntryState {
	uid: string;
	firstName: string;
	lastName: string;
	currencyAddresses: CurrencyAddress[];
}

interface SdnIdState {
	type: string;
	number: string;
}

export interface SdnListContents {
	readonly publishDate: string;
	readonly recordCount: string;
	readonly entryCount: number;
	readonly addresses: readonly SdnAddress[];
}

const emptyEntry = (): SdnEntryState => ({
	uid: '',
	firstName: '',
	lastName: '',
	currencyAddresses: [],
});

const emptyId = (): SdnIdState => ({ type: '', number: '' });

function evmCurrencyAddress(id: SdnIdState): CurrencyAddress | null {
	if (!id.type.startsWith(SDN_DIGITAL_CURRENCY_ID_TYPE_PREFIX)) return null;
	if (!isAddress(id.number, { strict: false })) return null;
	return {
		currency: id.type.slice(SDN_DIGITAL_CURRENCY_ID_TYPE_PREFIX.length),
		address: id.number.toLowerCase() as Address,
	};
}

function entityName({ firstName, lastName }: SdnEntryState): string {
	return [firstName, lastName]
		.filter((part) => part.length > 0)
		.join(SDN_NAME_SEPARATOR);
}

export class SdnListCollector {
	private publishDate = '';
	private recordCount = '';
	private entryCount = 0;
	private entry = emptyEntry();
	private id = emptyId();
	private readonly addresses = new Map<Address, SdnAddress>();

	element(name: string, parent: string | undefined, text: string): void {
		if (parent === SDN_XML_ELEMENT.PUBLISH_INFORMATION) {
			this.publishInformation(name, text);
		} else if (parent === SDN_XML_ELEMENT.ENTRY) {
			this.entryField(name, text);
		} else if (parent === SDN_XML_ELEMENT.ID) {
			this.idField(name, text);
		}
		if (name === SDN_XML_ELEMENT.ID && parent === SDN_XML_ELEMENT.ID_LIST) {
			this.closeId();
		}
		if (name === SDN_XML_ELEMENT.ENTRY) this.closeEntry();
	}

	contents(): SdnListContents {
		return {
			publishDate: this.publishDate,
			recordCount: this.recordCount,
			entryCount: this.entryCount,
			addresses: [...this.addresses.values()],
		};
	}

	private publishInformation(name: string, text: string): void {
		if (name === SDN_XML_ELEMENT.PUBLISH_DATE) this.publishDate = text;
		if (name === SDN_XML_ELEMENT.RECORD_COUNT) this.recordCount = text;
	}

	private entryField(name: string, text: string): void {
		if (name === SDN_XML_ELEMENT.UID) this.entry.uid = text;
		if (name === SDN_XML_ELEMENT.FIRST_NAME) this.entry.firstName = text;
		if (name === SDN_XML_ELEMENT.LAST_NAME) this.entry.lastName = text;
	}

	private idField(name: string, text: string): void {
		if (name === SDN_XML_ELEMENT.ID_TYPE) this.id.type = text;
		if (name === SDN_XML_ELEMENT.ID_NUMBER) this.id.number = text;
	}

	private closeId(): void {
		const currencyAddress = evmCurrencyAddress(this.id);
		if (currencyAddress) this.entry.currencyAddresses.push(currencyAddress);
		this.id = emptyId();
	}

	private closeEntry(): void {
		if (!SDN_UID_PATTERN.test(this.entry.uid)) {
			throw new Error(`An SDN entry has the invalid uid "${this.entry.uid}"`);
		}
		this.entryCount += 1;
		const sdnEntryUid = Number(this.entry.uid);
		const name = entityName(this.entry);
		for (const { currency, address } of this.entry.currencyAddresses) {
			this.record({ address, sdnEntryUid, entityName: name, currency });
		}
		this.entry = emptyEntry();
	}

	private record(listed: SdnAddress): void {
		const known = this.addresses.get(listed.address);
		if (!known) {
			this.addresses.set(listed.address, listed);
			return;
		}
		const currencies = known.currency.split(SANCTIONED_CURRENCY_SEPARATOR);
		if (currencies.includes(listed.currency)) return;
		this.addresses.set(listed.address, {
			...known,
			currency: [...currencies, listed.currency].join(
				SANCTIONED_CURRENCY_SEPARATOR
			),
		});
	}
}
