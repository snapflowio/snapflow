// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package web

import (
	"net/http"
	"net/url"
	"strings"
)

const (
	fetchSiteSameOrigin = "same-origin"
	fetchSiteNone       = "none"
	nullOrigin          = "null"
)

// AllowsUnsafeRequest blocks cross-site request forgery against requests that
// carry ambient credentials, following Go's http.CrossOriginProtection: safe
// methods pass, then Sec-Fetch-Site, then Origin; a request with neither
// header is a non-browser client and passes. trusted admits extra origins.
func AllowsUnsafeRequest(request *http.Request, trusted func(*url.URL) bool) bool {
	switch request.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	fetchSite := strings.ToLower(strings.TrimSpace(request.Header.Get(FetchSite)))
	if fetchSite == fetchSiteSameOrigin || fetchSite == fetchSiteNone {
		return true
	}
	originValue := strings.TrimSpace(request.Header.Get(Origin))
	if originValue == "" {
		return fetchSite == ""
	}
	if originValue == nullOrigin {
		return false
	}
	origin, err := url.Parse(originValue)
	if err != nil || origin.Host == "" || origin.User != nil {
		return false
	}
	return IsSameOrigin(request) || trusted(origin)
}
