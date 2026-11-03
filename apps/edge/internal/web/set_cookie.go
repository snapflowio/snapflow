// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package web

import (
	"net/http"
	"strings"
)

const (
	cookieAttributeSeparator = ";"
	cookieValueSeparator     = "="
	cookieDomainAttribute    = "domain"
)

// ConfineUpstreamCookies keeps every cookie a guest sets on the exact host that
// set it, so sandbox code cannot toss cookies onto a parent domain, and drops
// cookies that would shadow the edge's own reserved cookies. Only the Domain
// attribute is removed; every other attribute is kept verbatim.
func ConfineUpstreamCookies(header http.Header, reservedPrefixes ...string) {
	values := header.Values(SetCookie)
	if len(values) == 0 {
		return
	}
	header.Del(SetCookie)
	for _, value := range values {
		if confined, kept := confineCookie(value, reservedPrefixes); kept {
			header.Add(SetCookie, confined)
		}
	}
}

func confineCookie(value string, reservedPrefixes []string) (string, bool) {
	attributes := strings.Split(value, cookieAttributeSeparator)
	if isReservedCookie(attributes[0], reservedPrefixes) {
		return "", false
	}
	kept := attributes[:1]
	for _, attribute := range attributes[1:] {
		if !strings.EqualFold(strings.TrimSpace(attributeKey(attribute)), cookieDomainAttribute) {
			kept = append(kept, attribute)
		}
	}
	return strings.Join(kept, cookieAttributeSeparator), true
}

// A nameless cookie ("=value" or "value") is sent as its value alone, so its
// value is checked as the name a browser would send.
func isReservedCookie(nameValue string, reservedPrefixes []string) bool {
	name := strings.TrimSpace(attributeKey(nameValue))
	if name == "" {
		name = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(nameValue), cookieValueSeparator))
	}
	for _, prefix := range reservedPrefixes {
		if strings.HasPrefix(strings.ToLower(name), strings.ToLower(prefix)) {
			return true
		}
	}
	return false
}

func attributeKey(attribute string) string {
	if index := strings.Index(attribute, cookieValueSeparator); index >= 0 {
		return attribute[:index]
	}
	return attribute
}
