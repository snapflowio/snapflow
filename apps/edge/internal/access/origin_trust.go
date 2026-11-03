// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

const (
	hostLabelSeparator = "."
	sandboxIDSeparator = "-"
)

// trustedOrigin admits the route's allowed origins (the dashboard) and the
// sandbox's own other hosts, so a frontend on one port can call its API on
// another; other sandboxes and other sites stay untrusted.
func trustedOrigin(request *http.Request, route routes.HTTP) func(*url.URL) bool {
	return func(origin *url.URL) bool {
		return slices.Contains(route.Policy.AllowedOrigins, origin.Scheme+"://"+origin.Host) ||
			(origin.Scheme == web.SchemeHTTPS && sameSandboxHost(origin.Hostname(), routes.NormalizeHost(request.Host), route.SandboxID))
	}
}

func sameSandboxHost(originHost, requestHost, sandboxID string) bool {
	if sandboxID == "" {
		return false
	}
	originLabel, originParent, originFound := strings.Cut(strings.ToLower(originHost), hostLabelSeparator)
	requestLabel, requestParent, requestFound := strings.Cut(strings.ToLower(requestHost), hostLabelSeparator)
	suffix := sandboxIDSeparator + strings.ToLower(sandboxID)
	return originFound && requestFound && originParent == requestParent &&
		strings.HasSuffix(originLabel, suffix) && strings.HasSuffix(requestLabel, suffix)
}
