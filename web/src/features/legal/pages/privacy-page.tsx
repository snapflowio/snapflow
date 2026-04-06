/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LegalContentLayout } from '@/components/layouts/legal-content-layout';
import { Path } from '@/constants/paths';
import { SITE_CONFIG } from '@/constants/site';

export default function PrivacyPage() {
	return (
		<LegalContentLayout title="Privacy Policy" lastUpdated="February 16, 2026">
			<p>
				Your privacy is important to us. This Privacy Policy
				(&quot;Policy&quot;) applies to services provided by {SITE_CONFIG.NAME}{' '}
				(&quot;we&quot;, &quot;us&quot;, or &quot;
				{SITE_CONFIG.NAME}&quot;) and our website (the &quot;Site&quot;),
				product pages, applications, or other digital products that link to or
				reference this Policy (collectively, the &quot;Services&quot;) and
				explains what information we collect from users of our Services (a
				&quot;user&quot;, &quot;you&quot;, or &quot;your&quot;), including
				information that may be used to personally identify you (&quot;Personal
				Information&quot;) and how we use it.
			</p>

			<p>
				{SITE_CONFIG.NAME} does not sell your data or use your data to train AI
				models. We are committed to protecting your privacy and ensuring the
				security of your personal information.
			</p>

			<p>
				We encourage you to read the details below. This Policy applies to any
				visitor to or user of our Services. Any capitalized terms used herein
				but not defined shall have the meaning set forth in our Terms of
				Service, available at <a href={Path.TERMS}>{SITE_CONFIG.URL}/terms</a>.
			</p>

			<p>
				We reserve the right to change this Policy at any time. We will notify
				you of any changes to this Policy by posting a new Policy to this page
				and/or by sending notice to the primary email address specified in your
				account. You are responsible for ensuring we have an up-to-date active
				and deliverable email address for you, and for periodically reviewing
				this Policy to check for any changes. Changes to this Policy are
				effective when they are posted on this page.
			</p>

			<h2 id="scope-and-applicability">Scope and Applicability</h2>

			<p>
				This Policy applies to your information when you visit our website or
				otherwise use the Services. Please note that this Policy does not apply
				to the extent that we process Personal Information in the role of a
				processor (or a comparable role such as a &quot;service provider&quot;
				in certain jurisdictions) on behalf of our Customers, including where we
				collect Customer Data on behalf of our Customers, or where our Customers
				otherwise collect, use, share or process Personal Information via our
				Services.
			</p>

			<p>
				Each of our Customers, not {SITE_CONFIG.NAME}, controls what information
				about you is collected by the Services on behalf of such Customer. For
				detailed privacy information applicable to situations where a Customer
				who uses the Services is the controller, please reach out to the
				respective customer directly. We are not responsible for the privacy or
				data security practices of our Customers, which may differ from those
				set forth in this Privacy Policy.
			</p>

			<p>
				This Privacy Policy also does not apply to any third-party applications
				or services that are used in connection with our Services, or any other
				products, services or accounts provided by other entities under their
				own terms of service and privacy policy (collectively, &quot;Third-Party
				Services&quot;). The Site or Services may contain links to other
				websites. We have no control over these websites and they are subject to
				their own terms of use and privacy policies.
			</p>

			<h2 id="information-we-collect">What Information Do We Collect?</h2>

			<h3 id="information-you-provide">Information You Provide to Us</h3>

			<ul>
				<li>
					<strong>Account Information.</strong> To create an account for the
					Services or to enable certain features, we may require that you
					provide us with information for your account such as name, email,
					profile picture, password, and authentication credentials.
				</li>
				<li>
					<strong>Payment Information.</strong> If you sign up for a paid
					subscription, we (or our payment processors) may need your billing
					details such as credit card information, banking information, and
					billing address. Your payment information is collected and stored by
					our third party payment processing company and use and storage of that
					information is governed by the Payment Processor&apos;s applicable
					privacy policy.
				</li>
				<li>
					<strong>Sandbox Data and Code.</strong> In using our Services, our
					customers may submit, upload, or execute code, scripts, files, and
					other data within their sandbox environments. Our use of and
					processing of Customer Data is governed by our Terms of Service or
					other services agreement with the Customer.
				</li>
				<li>
					<strong>Business Contact Information.</strong> If you are a business
					representative, we collect your information in connection with the
					performance of the agreement or potential agreement with us. This
					information may include your first name, last name, contact
					information (e.g., email, phone, address), job title, and any other
					information related to the performance of the agreement with us.
				</li>
				<li>
					<strong>Other Information You Provide.</strong> We receive other
					information from you when you choose to interact with us in other
					ways, such as if you participate in a research study or event, or
					otherwise communicate with us.
				</li>
			</ul>

			<h3 id="information-collected-automatically">
				Information We Collect Automatically
			</h3>

			<p>
				When you visit, use, and interact with the Services, we may receive the
				following information about your visit, use, or interactions
				(&quot;Technical Information&quot;):
			</p>

			<ul>
				<li>
					<strong>Log Data.</strong> Information that your browser automatically
					sends whenever you use our website (&quot;log data&quot;). Log data
					includes your internet protocol address, browser type and settings,
					the date and time of your request, and how you interacted with our
					website.
				</li>
				<li>
					<strong>Usage Data.</strong> We may automatically collect information
					about your use of the Services, such as the types of content that you
					view or engage with, the features you use and the actions you take, as
					well as your time zone, country, the dates and times of access, user
					agent and version, type of device, and similar information.
				</li>
				<li>
					<strong>Device Information.</strong> Includes name of the device,
					operating system, and browser you are using. Information collected may
					depend on the type of device you use and its settings.
				</li>
				<li>
					<strong>Analytics.</strong> We may use analytics tools to help us
					analyze how users use our Services and enhance your experience when
					you use the Services.
				</li>
			</ul>

			<h3 id="information-from-third-parties">
				Information We Receive from Third Parties
			</h3>

			<ul>
				<li>
					<strong>Third-Party Authentication.</strong> If you sign up or login
					to our Services using one of our sign-on providers (e.g., Google,
					GitHub, etc.), we collect authentication information provided to us by
					the provider to allow you to log in.
				</li>
				<li>
					<strong>Service Providers.</strong> We may receive information from
					our service providers, who help us operate our business.
				</li>
				<li>
					<strong>Information from Other Sources.</strong> We may obtain
					information from other sources, including, but not limited to,
					publicly available sources, third-party data providers, and other
					sources.
				</li>
			</ul>

			<h2 id="how-we-use-information">
				How Do We Use The Information We Collect?
			</h2>

			<p>We use the information we collect:</p>

			<ul>
				<li>
					To deliver and improve the Services and your overall user experience
				</li>
				<li>
					To protect, investigate, and deter against fraudulent, unauthorized,
					or illegal activity
				</li>
				<li>
					To develop, improve or expand our business, products and services
				</li>
				<li>To conduct internal reporting, auditing, and research</li>
				<li>
					To compare and verify information for accuracy and update our records
				</li>
				<li>
					To email, message, or otherwise contact you with information and
					updates about us and the Services
				</li>
				<li>
					To respond to your comments and questions and provide customer service
				</li>
				<li>
					To send you information including confirmations, invoices, technical
					notices, updates, security alerts, and support and administrative
					messages
				</li>
				<li>
					To analyze how you use the Services with analytics tools to help us
					understand traffic patterns and identify issues with the Services
				</li>
				<li>
					To combine information with other data we already have to improve your
					experience with our Services
				</li>
				<li>
					In connection with a merger, acquisition, reorganization or similar
					transaction
				</li>
				<li>When required by law or to respond to legal process</li>
				<li>
					To protect our users and/or the rights or property of{' '}
					{SITE_CONFIG.NAME}
				</li>
				<li>To maintain the security of the Services</li>
				<li>
					At your direction or instruction, or for any other purpose with your
					consent
				</li>
				<li>
					To create aggregate and de-identified data. We will maintain such data
					in a de-identified form and will not attempt to re-identify any
					de-identified data
				</li>
			</ul>

			<h2 id="sharing-information">Do We Share Your Personal Information?</h2>

			<p>
				In addition to the specific situations discussed elsewhere in this
				privacy policy, we disclose personal information in the following
				circumstances:
			</p>

			<ul>
				<li>
					<strong>With our corporate affiliates and subsidiaries</strong>
				</li>
				<li>
					<strong>With the applicable Customer</strong> to provide Services on
					their behalf. Our Customers are independent entities and their
					processing of information is subject to their own policies and terms
				</li>
				<li>
					<strong>With third parties</strong> that perform services to support
					our core business functions and internal operations, which may
					include:
					<ul>
						<li>Cloud computing and hosting providers</li>
						<li>Payment processors</li>
						<li>Support and customer service providers</li>
						<li>Security and fraud prevention service providers</li>
						<li>Analytics service providers</li>
					</ul>
				</li>
				<li>
					<strong>
						To support our audit, compliance, and corporate governance functions
					</strong>
				</li>
				<li>
					<strong>In connection with a change of ownership</strong> or control
					of all or part of our business (such as a merger, acquisition,
					reorganization, or bankruptcy)
				</li>
				<li>
					<strong>If required or permitted by applicable law</strong> or
					regulation, or in the good faith belief that such action is necessary
					to comply with legal obligations, protect and defend the rights or
					property of {SITE_CONFIG.NAME}, or protect the safety of users
				</li>
				<li>
					<strong>With your consent or at your direction</strong>
				</li>
			</ul>

			<h2 id="tracking-technologies">How Do We Use Tracking Technologies?</h2>

			<p>
				Some of the features on the Services may require the use of
				&quot;cookies&quot; - small text files that are stored on your
				device&apos;s hard drive. We use cookies to enable our servers to
				recognize your web browser and tell us how and when you visit and use
				our Services, to remember your preferences, analyze trends, learn about
				our user base, provide relevant content, and operate and improve our
				Services.
			</p>

			<p>
				You may delete and block all cookies from our Services, but parts of the
				Services may not work or your overall user experience may be diminished,
				since it will no longer be personalized to you. It may also prevent you
				from saving customized settings, like log-in information.
			</p>

			<h2 id="data-security">Data Security</h2>

			<p>
				We implement appropriate technical and organizational security measures
				designed to protect your Personal Information against accidental or
				unlawful destruction, loss, alteration, unauthorized disclosure, or
				access. However, no method of transmission over the internet or
				electronic storage is completely secure, and we cannot guarantee
				absolute security.
			</p>

			<p>
				Sandboxes are isolated by design and operate in ephemeral environments.
				All sandbox data is automatically deleted after the sandbox terminates,
				unless explicitly configured otherwise by the customer.
			</p>

			<h2 id="data-retention">Data Retention</h2>

			<p>
				We retain your Personal Information for as long as necessary to provide
				the Services you have requested, or for other legitimate purposes such
				as complying with legal obligations, resolving disputes, and enforcing
				our agreements. Sandbox execution data is typically retained for a
				limited period as specified in our service documentation.
			</p>

			<h2 id="your-rights">Your Rights and Choices</h2>

			<p>
				Depending on your location and applicable laws, you may have certain
				rights regarding your Personal Information, including:
			</p>

			<ul>
				<li>
					<strong>Access:</strong> You may request access to the Personal
					Information we hold about you
				</li>
				<li>
					<strong>Correction:</strong> You may request that we correct
					inaccurate Personal Information
				</li>
				<li>
					<strong>Deletion:</strong> You may request that we delete your
					Personal Information
				</li>
				<li>
					<strong>Portability:</strong> You may request a copy of your Personal
					Information in a portable format
				</li>
				<li>
					<strong>Objection:</strong> You may object to our processing of your
					Personal Information
				</li>
				<li>
					<strong>Restriction:</strong> You may request that we restrict the
					processing of your Personal Information
				</li>
			</ul>

			<p>
				To exercise any of these rights, please contact us at{' '}
				<a href={SITE_CONFIG.SUPPORT_EMAIL}>{SITE_CONFIG.SUPPORT_EMAIL}</a>. We
				will respond to your request in accordance with applicable law.
			</p>

			<h2 id="international-transfers">International Data Transfers</h2>

			<p>
				Your Personal Information may be transferred to, stored, and processed
				in countries other than your country of residence. These countries may
				have data protection laws that are different from the laws of your
				country. We take appropriate safeguards to ensure that your Personal
				Information remains protected in accordance with this Privacy Policy.
			</p>

			<h2 id="children-privacy">Children&apos;s Privacy</h2>

			<p>
				Our Services are not intended for children under the age of 13, and we
				do not knowingly collect Personal Information from children under 13. If
				you believe we have collected information from a child under 13, please
				contact us immediately.
			</p>

			<h2 id="changes-to-policy">Changes to This Privacy Policy</h2>

			<p>
				We may update this Privacy Policy from time to time. We will notify you
				of any material changes by posting the new Privacy Policy on this page
				and updating the &quot;Last updated&quot; date. We encourage you to
				review this Privacy Policy periodically for any changes.
			</p>

			<h2 id="contact-us">Contact Us</h2>

			<p>
				If you have any questions about this Privacy Policy or our privacy
				practices, please contact us at:
			</p>

			<p>
				Email:{' '}
				<a href={SITE_CONFIG.SUPPORT_EMAIL}>{SITE_CONFIG.SUPPORT_EMAIL}</a>
			</p>
		</LegalContentLayout>
	);
}
