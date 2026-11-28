/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SITE_CONFIG } from '@/config/site';
import { formatUsd, PRICING } from '@/data/pricing';
import { LegalContentLayout } from './legal-content-layout';

export function TermsPage() {
	return (
		<LegalContentLayout
			title="Terms of Service"
			lastUpdated="November 12, 2026"
		>
			<p>
				This Customer Terms of Service is entered into by and between{' '}
				{SITE_CONFIG.NAME} (&quot;
				{SITE_CONFIG.NAME}&quot; or &quot;we&quot;) and the entity or person
				placing an order for or accessing any Services (&quot;Customer&quot; or
				&quot;you&quot;). If you are accessing or using the Services on behalf
				of your company, you represent that you are authorized to accept this
				Agreement on behalf of your company, and all references to
				&quot;you&quot; or &quot;Customer&quot; reference your company.
			</p>

			<p>
				<strong>
					Please note that if you sign up for the Services using an email
					address from your employer or another entity, then (1) you will be
					deemed to represent such party, (2) your acceptance will bind your
					employer or that entity to these terms, and (3) the words
					&quot;Customer&quot;, &quot;you&quot; or &quot;your&quot; in this
					Agreement will refer to your employer or that entity.
				</strong>
			</p>

			<p>
				The &quot;Effective Date&quot; of this Agreement is the earlier of (a)
				Customer&apos;s initial access to the Services through any online
				provisioning, registration or order process or (b) the effective date of
				any order form referencing this Agreement.
			</p>

			<p>
				<strong>
					By indicating your acceptance of this agreement or accessing or using
					any services, you are agreeing to be bound by all terms, conditions,
					and notices contained or referenced in this agreement. If you do not
					agree to this agreement, please do not use any services.
				</strong>
			</p>

			<h2 id="definitions">1. Definitions</h2>

			<ul>
				<li>
					<strong>&quot;Agreement&quot;</strong> means this Customer Terms of
					Service, any order forms, and any attachments, linked policies or
					documents referenced in the foregoing.
				</li>
				<li>
					<strong>&quot;Volume&quot;</strong> means persistent block storage
					attached to a Sandbox and retained independently of that
					Sandbox&apos;s lifecycle.
				</li>
				<li>
					<strong>&quot;Customer Data&quot;</strong> means any data in
					electronic form that Customer or Users make available through the
					Platform or that is otherwise collected by {SITE_CONFIG.NAME} on
					behalf of Customer or its Users, including code, files, environment
					variables, Volume contents, backups, and Sandbox runtime state.
				</li>
				<li>
					<strong>&quot;Documentation&quot;</strong> means {SITE_CONFIG.NAME}
					&apos;s user guides and other end user documentation for the Services
					made available by {SITE_CONFIG.NAME} to its customers.
				</li>
				<li>
					<strong>&quot;Fees&quot;</strong> means any fees payable for the
					Services, including metered usage charges at a Host&apos;s machine
					price, the {SITE_CONFIG.NAME} fee, Host disk charges, and{' '}
					{SITE_CONFIG.NAME} storage charges.
				</li>
				<li>
					<strong>&quot;Escrow&quot;</strong> means the non-custodial smart
					contract on a public blockchain that holds Customer&apos;s USDC
					deposits and from which Hosts and {SITE_CONFIG.NAME} are paid for
					Customer&apos;s usage.
				</li>
				<li>
					<strong>&quot;Host&quot;</strong> means a person or entity, which may
					be an independent third party, that operates a machine on which
					Sandboxes run.
				</li>
				<li>
					<strong>&quot;Platform&quot;</strong> means the {SITE_CONFIG.NAME}{' '}
					sandbox platform and associated infrastructure.
				</li>
				<li>
					<strong>&quot;Sandbox&quot;</strong> means an isolated container image
					executed inside a hardware-isolated microVM environment provisioned
					through the Platform that consumes compute, memory, GPU, and disk
					resources during its lifecycle.
				</li>
				<li>
					<strong>&quot;Services&quot;</strong> means the services that{' '}
					{SITE_CONFIG.NAME} will provide to Customer under this Agreement,
					including access to the Platform, Sandbox environments, Volumes, and
					related features.
				</li>
				<li>
					<strong>&quot;Balance&quot;</strong> means the USDC Customer has
					deposited into the Escrow that has not been spent or withdrawn.
				</li>
				<li>
					<strong>&quot;Users&quot;</strong> means employees, agents,
					consultants or other representatives authorized by Customer to access
					or use the Services.
				</li>
			</ul>

			<h2 id="the-services">2. The Services</h2>

			<h3 id="grant-of-access">2.1 Grant of Access</h3>

			<p>
				Subject to the terms and conditions set forth in this Agreement,{' '}
				{SITE_CONFIG.NAME} grants to Customer a limited, non-transferable,
				non-exclusive right to access and use the Services for its lawful
				internal business purposes solely in the form provided by{' '}
				{SITE_CONFIG.NAME} and as permitted by the functionalities provided
				therein. Access to paid Services is subject to Customer maintaining a
				sufficient Balance, as further described in Section 4.
			</p>

			<h3 id="ownership">2.2 Ownership</h3>

			<p>
				All rights and title in and to the Platform, the Services, and
				Documentation, including all enhancements, derivatives, and improvements
				to the foregoing and all intellectual property rights inherent therein,
				belong exclusively to {SITE_CONFIG.NAME} and its licensors. No rights
				are granted to Customer other than as expressly set forth in this
				Agreement.
			</p>

			<h3 id="restrictions">2.3 Restrictions</h3>

			<p>
				Customer shall not, and shall not permit any User or third party to:
			</p>

			<ul>
				<li>
					Reverse engineer, decompile, disassemble or otherwise attempt to
					discover the source code or underlying algorithms of the Services
				</li>
				<li>
					Modify, translate, or create derivative works based on the Services or
					Documentation
				</li>
				<li>
					Copy, rent, lease, distribute, or otherwise transfer rights to the
					Services or Documentation
				</li>
				<li>Use the Services for timesharing or service bureau purposes</li>
				<li>
					Remove or modify any proprietary marking or restrictive legends placed
					on the Services
				</li>
				<li>
					Use the Services in any manner that could damage, disable, overburden,
					or impair the Services or interfere with any other party&apos;s use of
					the Services
				</li>
				<li>
					Attempt to gain unauthorized access to the Services or related systems
					or networks
				</li>
				<li>
					Use the Services for any illegal purpose or in violation of any
					applicable laws or regulations
				</li>
			</ul>

			<h3 id="acceptable-use">2.4 Acceptable Use</h3>

			<p>
				Customer is responsible for all activity occurring under its account and
				shall ensure that its use of the Services complies with this Agreement
				and all applicable laws. Customer shall not use the Services to:
			</p>

			<ul>
				<li>
					Engage in any illegal activity or violate any laws or regulations,
					including but not limited to copyright, trademark, privacy, or export
					control laws
				</li>
				<li>
					Distribute malware, viruses, or other harmful code (except within
					isolated sandbox environments for legitimate testing purposes)
				</li>
				<li>Engage in cryptocurrency mining activities</li>
				<li>
					Conduct distributed denial of service (DDoS) attacks or similar
					activities
				</li>
				<li>
					Attempt to breach or circumvent any security or authentication
					measures
				</li>
				<li>
					Access or search the Services by any means other than our publicly
					supported interfaces
				</li>
				<li>
					Interfere with or disrupt the integrity or performance of the Services
					or third-party data contained therein
				</li>
			</ul>

			<h2 id="customer-data">3. Customer Data</h2>

			<h3 id="customer-ownership">3.1 Customer Ownership</h3>

			<p>
				Except for the limited rights expressly granted to {SITE_CONFIG.NAME}{' '}
				hereunder, Customer retains all rights, title and interest in and to all
				Customer Data, including without limitation all related intellectual
				property rights inherent therein. Customer is solely responsible for the
				accuracy, quality, legality, reliability, and appropriateness of all
				Customer Data.
			</p>

			<h3 id="authorization">3.2 Authorization</h3>

			<p>
				Customer grants {SITE_CONFIG.NAME} a nonexclusive, worldwide,
				royalty-free right to reproduce, display, adapt, modify, transmit,
				distribute and otherwise use the Customer Data (a) to maintain, provide,
				and improve the Services under this Agreement; (b) to prevent or address
				technical or security issues and resolve support requests; (c) at
				Customer&apos;s direction or request; and (d) as otherwise required by
				applicable law.
			</p>

			<h3 id="data-security">3.3 Data Security</h3>

			<p>
				{SITE_CONFIG.NAME} shall use commercially reasonable measures to
				maintain the security and integrity of the Services and the Customer
				Data. Sandbox environments are isolated by default using microVMs,
				resource limits, and per-Sandbox network controls. Sandboxes run only on
				Linux machines, using Firecracker or Cloud Hypervisor through KVM; macOS
				machines are not supported. Sandbox runtime state is ephemeral and is
				destroyed when the Sandbox is deleted. Volume contents persist until the
				Volume is deleted. Encrypted backup artifacts are retained in
				machine-independent object storage according to the configured backup
				policy and {SITE_CONFIG.NAME}&apos;s data retention practices.
			</p>

			<p>
				Customer acknowledges that no security boundary is absolute and that the
				Sandbox isolation model relies on the underlying hypervisor, host
				operating system, hardware, and infrastructure. Customer is responsible
				for not running code in a Sandbox that Customer is not authorized to
				run, and for applying any additional controls required by
				Customer&apos;s threat model.
			</p>

			<h3 id="third-party-hosts">3.4 Third-Party Hosts</h3>

			<p>
				Sandboxes, including their runtime state and attached Volumes, may run
				on machines operated by Hosts that are independent third parties.{' '}
				{SITE_CONFIG.NAME} isolates each Sandbox from the Host&apos;s systems
				and from other Sandboxes, but the Host operating the physical machine
				can technically access the workloads and data running on it.
			</p>

			<p>
				Customer shall not run workloads that require confidentiality from the
				operator of the underlying infrastructure unless a feature of the
				Services expressly states that it provides that confidentiality.
			</p>

			<h2 id="fees-and-payment">4. Fees and Payment</h2>

			<h3 id="billing-model">4.1 Billing Model</h3>

			<p>
				{SITE_CONFIG.NAME} bills usage on a per-second metered basis against
				Customer&apos;s Balance. Customer funds usage in advance by depositing
				USDC into the Escrow, with a minimum deposit of $5. The Escrow is
				non-custodial: {SITE_CONFIG.NAME} does not hold Customer&apos;s funds,
				and amounts leave the Balance only as payment for metered usage or as a
				withdrawal by Customer. Prices are shown in US dollars and settled in
				USDC at one USDC per US dollar. Fees charged by exchanges or other third
				parties for acquiring or sending USDC are Customer&apos;s
				responsibility.
			</p>

			<p>
				Charges for compute and Host disk are paid to the Host in USDC to a
				wallet the Host controls, once the amount owed reaches $10 or earlier
				when a settlement deadline approaches. The {SITE_CONFIG.NAME} fee and{' '}
				{SITE_CONFIG.NAME} storage charges are paid to {SITE_CONFIG.NAME}. The
				Balance never goes negative. A Sandbox starts only if the Balance covers
				one hour of all usage that would then be running, and compute stops when
				the Balance is nearly exhausted.
			</p>

			<h3 id="prices-and-metering">4.2 Prices and Metering</h3>

			<p>
				Each Host sets one hourly price for its machine. The price of a Sandbox
				is the Host&apos;s price for the share of the machine the Sandbox
				reserves, plus a {SITE_CONFIG.NAME} fee of 20% of that price, shown as
				one hourly price. The following are charged:
			</p>

			<ul>
				<li>
					<strong>Compute:</strong> charged per second while a Sandbox is
					running, with a minimum of 10 seconds per start.
				</li>
				<li>
					<strong>Host disk:</strong> charged per gigabyte (GiB) of provisioned
					disk per month, prorated per second, at the rate the Host set for that
					machine and shown to you before you create the Sandbox, while the
					Sandbox&apos;s disk is kept on the Host, whether the Sandbox is
					running or stopped.
				</li>
				<li>
					<strong>{SITE_CONFIG.NAME} storage:</strong> charged per gigabyte
					(GiB) of compressed stored data per month, prorated per second, at{' '}
					{formatUsd(PRICING.STORAGE_USD_PER_GIB_MONTH)} per GiB per month, for
					archived Sandboxes, snapshots, templates, and Volume backups. The
					first {PRICING.STORAGE_FREE_GIB} GiB per organization are free.
				</li>
			</ul>

			<p>
				Network traffic is included and is not billed, subject to the rate
				limits set out in the Documentation. No usage is billed after a
				machine&apos;s last healthy report to the Platform, and a session is not
				billed if its machine becomes unhealthy within 10 minutes of the Sandbox
				starting. Sandboxes in terminal states (such as error, build failed,
				destroyed, or destroying) do not accrue charges.
			</p>

			<p>
				Machines that Customer enrolls for its own organization and does not
				offer publicly are free to use: no compute, Host disk, or{' '}
				{SITE_CONFIG.NAME} fee is charged for them. {SITE_CONFIG.NAME} storage
				is charged for all Customers.
			</p>

			<h3 id="quotas-and-limits">4.3 Quotas and Limits</h3>

			<p>
				{SITE_CONFIG.NAME} may enforce operational quotas, including concurrent
				Sandbox capacity, per-Sandbox resource caps, per-organization storage
				limits, image counts, Volume counts, and network limits. Concurrent
				capacity may increase with Customer&apos;s total deposits. These quotas
				are separate from usage charges and may be enforced at the time of
				resource creation or while Services are running. Customer may set
				optional budgets on API keys; a key that reaches its budget cannot start
				new Sandboxes, and its running Sandboxes are stopped.
			</p>

			<h3 id="sandbox-lifecycle">4.4 Stopped and Archived Sandboxes</h3>

			<p>
				A stopped Sandbox keeps its disk on the Host and is charged only Host
				disk. A Sandbox is archived, its copy on the Host is deleted, and it is
				charged {SITE_CONFIG.NAME} storage instead, when the first of the
				following occurs: it has been stopped for 7 days (or another period from
				0 to 30 days set by Customer&apos;s organization), the Host is offline
				for more than one hour, the Host withdraws the machine, or the Balance
				reaches zero. When the Balance reaches zero, compute stops, all
				Sandboxes are archived, and archives are kept for 7 days and then
				deleted unless Customer adds funds. Sandboxes have no maximum lifetime.
			</p>

			<h3 id="deposits-and-withdrawals">4.5 Deposits and Withdrawals</h3>

			<p>
				Customer may enable automatic top-up by approving a USDC allowance to
				the Escrow and setting a top-up amount, a threshold, and a minimum
				interval between top-ups. {SITE_CONFIG.NAME} may then move that amount
				from Customer&apos;s wallet into Customer&apos;s own Balance only while
				the Balance is below the threshold, and at most once per interval. A
				withdrawal request removes the requested amount from the spendable
				Balance at once and is paid out to Customer after a 24-hour delay,
				during which Hosts may still claim amounts owed for usage already
				incurred.
			</p>

			<h3 id="payment-terms">4.6 Payment Terms</h3>

			<p>
				Customer must maintain a sufficient Balance for metered usage. Metered
				usage is charged against Customer&apos;s Balance according to the usage
				records. Network fees for on-chain transactions are paid in USDC by the
				party whose funds move: Customer pays for its deposits and withdrawals,
				and Hosts pay for their payouts. Fees are not refundable and{' '}
				{SITE_CONFIG.NAME} does not issue credits, except that{' '}
				{SITE_CONFIG.NAME} corrects confirmed errors in its own metering.{' '}
				{SITE_CONFIG.NAME} may block Customer&apos;s account and freeze its
				Balance in the Escrow where required by law, sanctions, or a legal
				process, or to address fraud or abuse. Customer is responsible for
				keeping billing information current.
			</p>

			<h3 id="taxes">4.7 Taxes</h3>

			<p>
				All Fees are exclusive of taxes, duties, or similar governmental
				assessments, including value-added, sales, use or withholding taxes.
				Customer is responsible for paying all such taxes except those based on{' '}
				{SITE_CONFIG.NAME}&apos;s net income.
			</p>

			<h3 id="price-changes">4.8 Price Changes</h3>

			<p>
				Hosts may change their machine prices and {SITE_CONFIG.NAME} may change
				its rates and quotas. A price decrease applies to running Sandboxes
				immediately. A price increase applies to a running Sandbox at its next
				start or after 30 days, whichever comes first, and Customer is notified
				by email. Customer may set a maximum price for a Sandbox; a Sandbox
				whose price rises above its maximum price is stopped and keeps its disk.
			</p>

			<h3 id="rounding-and-records">4.9 Rounding and Records of Usage</h3>

			<p>
				Usage is calculated per second from Sandbox runtime and stored data and
				converted to USDC amounts. Customer&apos;s ledger, available through the
				Platform, is the authoritative record of metered consumption. Monthly
				statements show Host compute, {SITE_CONFIG.NAME} storage, and the{' '}
				{SITE_CONFIG.NAME} fee separately.
			</p>

			<h2 id="term-and-termination">5. Term and Termination</h2>

			<h3 id="term">5.1 Term</h3>

			<p>
				This Agreement commences on the Effective Date and continues until
				terminated in accordance with this Section. Customer may continue using
				the Services as long as a sufficient Balance is available and this
				Agreement remains in effect.
			</p>

			<h3 id="termination-for-cause">5.2 Termination for Cause</h3>

			<p>
				Either party may terminate this Agreement if the other party materially
				breaches this Agreement and fails to cure such breach within 30 days
				after receiving written notice thereof.
			</p>

			<h3 id="effect-of-termination">5.3 Effect of Termination</h3>

			<p>
				Upon termination of this Agreement: (a) Customer&apos;s right to access
				and use the Services will immediately cease; (b) Customer may withdraw
				any unspent Balance from the Escrow as described in Section 4.5, unless
				it is frozen under Section 4.6; (c) any settled or accrued Fees prior to
				termination remain payable; and (d) {SITE_CONFIG.NAME} may delete
				Customer Data, Volumes, and Sandboxes in accordance with our data
				retention policies. Customer is responsible for exporting any Customer
				Data that Customer wishes to retain prior to termination taking effect.
			</p>

			<h2 id="warranties">6. Warranties and Disclaimers</h2>

			<h3 id="mutual-warranties">6.1 Mutual Warranties</h3>

			<p>Each party represents and warrants that:</p>

			<ul>
				<li>
					It has the legal power and authority to enter into this Agreement
				</li>
				<li>
					This Agreement constitutes a valid and binding obligation enforceable
					against it in accordance with its terms
				</li>
			</ul>

			<h3 id="disclaimer">6.2 Disclaimer</h3>

			<p>
				<strong>
					EXCEPT AS EXPRESSLY PROVIDED HEREIN, THE SERVICES ARE PROVIDED
					&quot;AS IS&quot; AND {SITE_CONFIG.NAME} MAKES NO WARRANTIES, EXPRESS
					OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OF
					MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
					NON-INFRINGEMENT. {SITE_CONFIG.NAME} DOES NOT WARRANT THAT THE
					SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
				</strong>
			</p>

			<h2 id="limitation-of-liability">7. Limitation of Liability</h2>

			<p>
				<strong>
					TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL{' '}
					{SITE_CONFIG.NAME} BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
					CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR
					REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF
					DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM: (A)
					YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICES;
					(B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICES; OR (C)
					UNAUTHORIZED ACCESS, USE OR ALTERATION OF YOUR TRANSMISSIONS OR
					CONTENT.
				</strong>
			</p>

			<p>
				<strong>
					{SITE_CONFIG.NAME}&apos;S TOTAL LIABILITY UNDER THIS AGREEMENT SHALL
					NOT EXCEED THE TOTAL AMOUNT PAID BY CUSTOMER FOR FEES IN THE 12 MONTHS
					PRECEDING THE EVENT GIVING RISE TO LIABILITY, OR $100 USD, WHICHEVER
					IS GREATER.
				</strong>
			</p>

			<h2 id="indemnification">8. Indemnification</h2>

			<p>
				Customer shall indemnify, defend, and hold harmless {SITE_CONFIG.NAME}{' '}
				from and against any claims, damages, losses, liabilities, costs, and
				expenses (including reasonable attorneys&apos; fees) arising out of or
				relating to: (a) Customer&apos;s use of the Services; (b) Customer Data;
				(c) Customer&apos;s violation of this Agreement; or (d) Customer&apos;s
				violation of any rights of another.
			</p>

			<h2 id="confidentiality">9. Confidentiality</h2>

			<p>
				Each party agrees to maintain the confidentiality of any confidential
				information received from the other party and to use such information
				only as necessary to perform its obligations under this Agreement. This
				obligation does not apply to information that: (a) is or becomes
				publicly available through no breach of this Agreement; (b) is
				rightfully received by the receiving party from a third party without
				breach of any confidentiality obligation; or (c) is independently
				developed by the receiving party.
			</p>

			<h2 id="general">10. General Terms</h2>

			<h3 id="governing-law">10.1 Governing Law</h3>

			<p>
				This Agreement shall be governed by and construed in accordance with the
				laws of the jurisdiction in which {SITE_CONFIG.NAME} is headquartered,
				without regard to its conflict of law provisions.
			</p>

			<h3 id="entire-agreement">10.2 Entire Agreement</h3>

			<p>
				This Agreement constitutes the entire agreement between the parties
				regarding the subject matter hereof and supersedes all prior or
				contemporaneous agreements, understandings, and communications, whether
				written or oral.
			</p>

			<h3 id="amendments">10.3 Amendments</h3>

			<p>
				{SITE_CONFIG.NAME} may modify this Agreement from time to time. We will
				notify you of material changes by email or through the Services. Your
				continued use of the Services after such notice constitutes acceptance
				of the modified Agreement.
			</p>

			<h3 id="assignment">10.4 Assignment</h3>

			<p>
				Customer may not assign this Agreement without {SITE_CONFIG.NAME}&apos;s
				prior written consent. {SITE_CONFIG.NAME} may assign this Agreement in
				connection with a merger, acquisition, or sale of all or substantially
				all of its assets.
			</p>

			<h3 id="severability">10.5 Severability</h3>

			<p>
				If any provision of this Agreement is held to be invalid or
				unenforceable, the remaining provisions will continue in full force and
				effect.
			</p>

			<h3 id="waiver">10.6 Waiver</h3>

			<p>
				No waiver of any provision of this Agreement shall be deemed or shall
				constitute a waiver of any other provision, nor shall any waiver
				constitute a continuing waiver.
			</p>

			<h2 id="contact">11. Contact Information</h2>

			<p>
				If you have any questions about these Terms of Service, please contact
				us at:
			</p>

			<p>
				Email:{' '}
				<a href={`mailto:${SITE_CONFIG.SUPPORT_EMAIL}`}>
					{SITE_CONFIG.SUPPORT_EMAIL}
				</a>
			</p>
		</LegalContentLayout>
	);
}
