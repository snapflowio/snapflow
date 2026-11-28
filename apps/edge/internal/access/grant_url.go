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

func isWellFormedGrant(grant string) bool {
	if len(grant) != base64.RawURLEncoding.EncodedLen(grantTokenBytes) {
		return false
	}
	decoded, err := base64.RawURLEncoding.DecodeString(grant)
	return err == nil && len(decoded) == grantTokenBytes
}

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

func sameHostLocation(target *url.URL) string {
	location := pathRoot + strings.TrimLeft(target.EscapedPath(), pathRoot)
	if target.RawQuery != "" {
		location += querySeparator + target.RawQuery
	}
	return location
}
