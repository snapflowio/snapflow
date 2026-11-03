// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"net"
	"net/http"
	"net/url"
	"strconv"

	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

const defaultHTTPSPort = 443

func httpsRedirectURL(request *http.Request, httpsPort uint16) string {
	host := routes.NormalizeHost(request.Host)
	if httpsPort != defaultHTTPSPort {
		host = net.JoinHostPort(host, strconv.Itoa(int(httpsPort)))
	}
	target := url.URL{Scheme: web.SchemeHTTPS, Host: host}
	return target.String() + request.URL.RequestURI()
}
