// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package protocol

import (
	"crypto/x509"
	"errors"
	"fmt"
	"net/url"
	"regexp"
)

const (
	originPrincipalSegment   = "origin"
	originIdentitySegmentLen = 2
)

var originSitePattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)

type OriginCertificateIdentity struct {
	Site string
}

func ValidateOriginSite(site string) error {
	if !originSitePattern.MatchString(site) {
		return fmt.Errorf("origin site %q must be a lowercase DNS label", site)
	}
	return nil
}

func (identity OriginCertificateIdentity) Validate() error {
	return ValidateOriginSite(identity.Site)
}

func OriginIdentityURI(identity OriginCertificateIdentity) (*url.URL, error) {
	if err := identity.Validate(); err != nil {
		return nil, err
	}
	return url.Parse(fmt.Sprintf("%s://%s/%s/%s", spiffeScheme, TunnelTrustDomain, originPrincipalSegment, identity.Site))
}

func ParseOriginCertificate(certificate *x509.Certificate) (OriginCertificateIdentity, error) {
	if certificate == nil {
		return OriginCertificateIdentity{}, errors.New("origin tunnel certificate is required")
	}
	for _, identityURI := range certificate.URIs {
		identity, err := parseOriginIdentityURI(identityURI)
		if err == nil {
			return identity, nil
		}
	}
	return OriginCertificateIdentity{}, errors.New("certificate has no valid origin tunnel identity")
}

func parseOriginIdentityURI(identityURI *url.URL) (OriginCertificateIdentity, error) {
	parts, err := identityPathSegments(identityURI)
	if err != nil {
		return OriginCertificateIdentity{}, err
	}
	if len(parts) != originIdentitySegmentLen || parts[0] != originPrincipalSegment {
		return OriginCertificateIdentity{}, errors.New("invalid origin tunnel identity path")
	}
	identity := OriginCertificateIdentity{Site: parts[1]}
	return identity, identity.Validate()
}
