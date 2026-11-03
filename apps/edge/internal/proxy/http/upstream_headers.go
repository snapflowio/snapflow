// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"net/http"
	"net/http/httptrace"
	"net/textproto"

	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/web"
)

// confineGuestCookies applies the edge's cookie rules to every header block a
// guest sends: no parent-domain cookies and no edge-reserved cookie names.
func confineGuestCookies(header http.Header) {
	web.ConfineUpstreamCookies(header, access.CookiePrefix, previewWarningCookieName)
}

// withInformationalHeaderFilter filters 1xx responses (such as 103 Early
// Hints), which the reverse proxy forwards without calling ModifyResponse.
// Trace hooks added later run first, so this hook cleans the shared header map
// before the reverse proxy copies it to the client.
func withInformationalHeaderFilter(request *http.Request) *http.Request {
	trace := &httptrace.ClientTrace{
		Got1xxResponse: func(code int, header textproto.MIMEHeader) error {
			if code == http.StatusSwitchingProtocols {
				return nil
			}
			web.StripAccessControlHeaders(http.Header(header))
			confineGuestCookies(http.Header(header))
			return nil
		},
	}
	return request.WithContext(httptrace.WithClientTrace(request.Context(), trace))
}

// selectTokenProtocol answers a WebSocket handshake whose only offered
// subprotocol was the access token entry the edge consumed: the guest selects
// none, and clients that offered a subprotocol reject a reply without one.
func selectTokenProtocol(response *http.Response, tokenProtocol string) {
	if tokenProtocol != "" && response.StatusCode == http.StatusSwitchingProtocols &&
		response.Header.Get(access.WebSocketProtocolHeader) == "" {
		response.Header.Set(access.WebSocketProtocolHeader, tokenProtocol)
	}
}
