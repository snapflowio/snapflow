/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LegalContentLayout } from '@/components/layouts/legal-content-layout';
import { SITE_CONFIG } from '@/constants/site';

export default function TermsPage() {
	return (
		<LegalContentLayout
			title="Terms of Service"
			lastUpdated="February 16, 2026"
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
					<strong>&quot;Customer Data&quot;</strong> means any data in
					electronic form that Customer or Users make available through the
					Platform or that is otherwise collected by {SITE_CONFIG.NAME} on
					behalf of Customer or its Users.
				</li>
				<li>
					<strong>&quot;Documentation&quot;</strong> means {SITE_CONFIG.NAME}
					&apos;s user guides and other end user documentation for the Services
					made available by {SITE_CONFIG.NAME} to its customers.
				</li>
				<li>
					<strong>&quot;Fees&quot;</strong> means any fees payable for the
					Services.
				</li>
				<li>
					<strong>&quot;Platform&quot;</strong> means the {SITE_CONFIG.NAME}{' '}
					sandbox platform and associated infrastructure.
				</li>
				<li>
					<strong>&quot;Services&quot;</strong> means the services that{' '}
					{SITE_CONFIG.NAME} will provide to Customer under this Agreement,
					including access to the Platform, sandbox environments, and related
					features.
				</li>
				<li>
					<strong>&quot;Credits&quot;</strong> refers to the amount of alloted
					funds that the Customer can utilize to run the Services.
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
				therein. Access to the Services is subject to Customer maintaining
				sufficient Credits in their account.
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
				Data. Sandbox environments are isolated by design and ephemeral by
				default, with data automatically deleted upon sandbox termination unless
				otherwise configured.
			</p>

			<h2 id="fees-and-payment">4. Fees and Payment</h2>

			<h3 id="credit-system">4.1 Credit System</h3>

			<p>
				{SITE_CONFIG.NAME} operates on a prepaid credit-based system. Customer
				must purchase Credits in advance to use the Services. Credits are
				consumed based on actual resource usage and are non-refundable except as
				expressly stated in this Agreement or as required by law.
			</p>

			<h3 id="resource-based-billing">4.2 Resource-Based Billing</h3>

			<p>
				Credits are charged on a per-second basis for computational resources
				consumed while sandboxes are running. Resource consumption is measured
				and billed for:
			</p>

			<ul>
				<li>
					CPU usage: charged per physical core (vCPU) per second, with a minimum
					of 1 core per sandbox
				</li>
				<li>Memory usage: charged per gigabyte (GiB) of RAM per second</li>
				<li>
					Storage usage: charged per gigabyte (GB) of disk storage per second
				</li>
			</ul>

			<p>
				Current pricing rates are displayed on our website and may be updated
				from time to time in accordance with Section 4.5. Billing begins when a
				sandbox starts running and stops when the sandbox is terminated.
				Customer is only charged for active sandbox runtime.
			</p>

			<h3 id="payment-terms">4.3 Payment Terms</h3>

			<p>
				Customer must maintain a valid payment method on file to purchase
				Credits. Credits may be purchased at any time through the Platform. When
				Customer&apos;s Credit balance is depleted, access to Services may be
				suspended until additional Credits are purchased. Customer is
				responsible for maintaining current and accurate payment information and
				sufficient Credit balance to continue using the Services.
			</p>

			<h3 id="taxes">4.4 Taxes</h3>

			<p>
				All Fees are exclusive of taxes, duties, or similar governmental
				assessments, including value-added, sales, use or withholding taxes.
				Customer is responsible for paying all such taxes except those based on{' '}
				{SITE_CONFIG.NAME}&apos;s net income.
			</p>

			<h3 id="price-changes">4.5 Price Changes</h3>

			<p>
				{SITE_CONFIG.NAME} may change the pricing rates for resource consumption
				by giving at least 30 days&apos; notice via email or through the
				Platform. Changed rates will apply to resource consumption occurring
				after the notice period. Credits purchased before a price change will
				continue to be consumed at the rate in effect when the resources are
				used, not when the Credits were purchased.
			</p>

			<h2 id="term-and-termination">5. Term and Termination</h2>

			<h3 id="term">5.1 Term</h3>

			<p>
				This Agreement commences on the Effective Date and continues until
				terminated in accordance with this Section. Customer may continue using
				the Services on a pay-as-you-go basis as long as sufficient Credits are
				available in their account and this Agreement remains in effect.
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
				and use the Services will immediately cease; (b) any unused Credits in
				Customer&apos;s account will be forfeited and non-refundable except as
				required by law; and (c) {SITE_CONFIG.NAME} may delete Customer Data in
				accordance with our data retention policies.
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
					NOT EXCEED THE TOTAL AMOUNT PAID BY CUSTOMER FOR CREDITS IN THE 12
					MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY, OR $100 USD,
					WHICHEVER IS GREATER.
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
				<a href={SITE_CONFIG.SUPPORT_EMAIL}>{SITE_CONFIG.SUPPORT_EMAIL}</a>
			</p>
		</LegalContentLayout>
	);
}
