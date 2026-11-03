// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"encoding/base64"
	"net/url"
	"strings"
)

const (
	grantTokenBytes     = 32
	queryPairSeparator  = "&"
	queryValueSeparator = "="
	querySeparator      = "?"
	pathRoot            = "/"
)

// isWellFormedGrant refuses anything that is not a grant the API could have
// issued (32 random bytes, unpadded base64url) before any API call is made.
func isWellFormedGrant(grant string) bool {
	if len(grant) != base64.RawURLEncoding.EncodedLen(grantTokenBytes) {
		return false
	}
	decoded, err := base64.RawURLEncoding.DecodeString(grant)
	return err == nil && len(decoded) == grantTokenBytes
}

// withoutAccessParameters removes the grant parameters from a raw query and
// keeps every other byte, so order, encoding and valueless keys reach the
// guest exactly as the client sent them.
func withoutAccessParameters(rawQuery string) string {
	if rawQuery == "" {
		return rawQuery
	}
	pairs := strings.Split(rawQuery, queryPairSeparator)
	kept := make([]string, 0, len(pairs))
	for _, pair := range pairs {
		if !isAccessParameter(pair) {
			kept = append(kept, pair)
		}
	}
	return strings.Join(kept, queryPairSeparator)
}

func isAccessParameter(pair string) bool {
	key := pair
	if index := strings.Index(pair, queryValueSeparator); index >= 0 {
		key = pair[:index]
	}
	decoded, err := url.QueryUnescape(key)
	return err == nil && (decoded == GrantQueryParameter || decoded == BackendQueryParameter)
}

// sameHostLocation is the clean URL a redeemed grant redirects to. Leading
// slashes are collapsed so a path such as //evil.example cannot become a
// protocol-relative redirect to another host.
func sameHostLocation(target *url.URL) string {
	location := pathRoot + strings.TrimLeft(target.EscapedPath(), pathRoot)
	if target.RawQuery != "" {
		location += querySeparator + target.RawQuery
	}
	return location
}
