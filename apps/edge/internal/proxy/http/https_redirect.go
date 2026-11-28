// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"

	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

const (
	defaultHTTPSPort = 443
	portBitSize      = 16
)

func listenPort(address string) (uint16, error) {
	_, port, err := net.SplitHostPort(address)
	if err != nil {
		return 0, fmt.Errorf("edge HTTPS address %q: %w", address, err)
	}
	value, err := strconv.ParseUint(port, 10, portBitSize)
	if err != nil || value == 0 {
		return 0, fmt.Errorf("edge HTTPS address %q must name a port", address)
	}
	return uint16(value), nil
}

func httpsRedirectURL(request *http.Request, httpsPort uint16) string {
	host := routes.NormalizeHost(request.Host)
	if httpsPort != defaultHTTPSPort {
		host = net.JoinHostPort(host, strconv.Itoa(int(httpsPort)))
	}
	target := url.URL{Scheme: web.SchemeHTTPS, Host: host}
	return target.String() + request.URL.RequestURI()
}
