// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/web"
)

// Programmatic clients redeem a grant in token mode and then present the
// signed session token instead of a cookie: as a header, or as a WebSocket
// subprotocol entry where the runtime cannot set headers (the Kubernetes
// pattern). Neither is an ambient credential, so neither needs origin checks,
// and the edge strips both before proxying, so the token never reaches the guest.
const (
	AccessTokenHeader         = "X-Snapflow-Access-Token"
	AccessModeHeader          = "X-Snapflow-Access-Mode"
	AccessModeToken           = "token"
	AccessTokenProtocolPrefix = "snapflow.access-token."
	WebSocketProtocolHeader   = "Sec-WebSocket-Protocol"
	protocolListSeparator     = ","
)

type TokenRedemption struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// sessionCredentials lists the tokens to try, in order. A presented token wins
// over cookies and never falls back to them. Every cookie with the reserved
// name is tried, so a same-name cookie planted by guest code cannot shadow the
// real one.
func sessionCredentials(request *http.Request, backendID uuid.UUID) ([]string, bool) {
	if token := presentedToken(request); token != "" {
		return []string{token}, true
	}
	cookies := request.CookiesNamed(cookieName(backendID))
	tokens := make([]string, 0, len(cookies))
	for _, cookie := range cookies {
		tokens = append(tokens, cookie.Value)
	}
	return tokens, false
}

func presentedToken(request *http.Request) string {
	if token := strings.TrimSpace(request.Header.Get(AccessTokenHeader)); token != "" {
		return token
	}
	return strings.TrimPrefix(TokenProtocol(request), AccessTokenProtocolPrefix)
}

func webSocketProtocols(header http.Header) []string {
	var protocols []string
	for _, value := range header.Values(WebSocketProtocolHeader) {
		for protocol := range strings.SplitSeq(value, protocolListSeparator) {
			if protocol = strings.TrimSpace(protocol); protocol != "" {
				protocols = append(protocols, protocol)
			}
		}
	}
	return protocols
}

// tokenBackend reads the backend a token was issued for without verifying it;
// routing uses it only to pin the request, and Authorize verifies the token.
func tokenBackend(token string) (uuid.UUID, bool) {
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != tokenSignedBytes || decoded[tokenVersionOffset] != tokenVersion {
		return uuid.Nil, false
	}
	backendID, err := uuid.FromBytes(decoded[tokenBackendOffset:tokenSessionOffset])
	return backendID, err == nil
}

// StripCredentials removes every edge credential before the request is
// proxied: the edge's cookies and the token subprotocol entry. Token headers
// are removed with the other X-Snapflow- headers by the upstream rewrite.
func StripCredentials(request *http.Request) {
	cookies := request.Cookies()
	request.Header.Del(web.Cookie)
	for _, cookie := range cookies {
		if !strings.HasPrefix(cookie.Name, CookiePrefix) {
			request.AddCookie(cookie)
		}
	}
	protocols := webSocketProtocols(request.Header)
	request.Header.Del(WebSocketProtocolHeader)
	kept := make([]string, 0, len(protocols))
	for _, protocol := range protocols {
		if !strings.HasPrefix(protocol, AccessTokenProtocolPrefix) {
			kept = append(kept, protocol)
		}
	}
	if len(kept) > 0 {
		request.Header.Set(WebSocketProtocolHeader, strings.Join(kept, web.ListSeparator))
	}
}

func wantsTokenRedemption(request *http.Request) bool {
	return strings.EqualFold(strings.TrimSpace(request.Header.Get(AccessModeHeader)), AccessModeToken)
}

func writeTokenRedemption(writer http.ResponseWriter, token string, expiresAt time.Time) error {
	writer.Header().Set(web.ContentType, web.JSONMediaType)
	if err := json.NewEncoder(writer).Encode(TokenRedemption{Token: token, ExpiresAt: expiresAt}); err != nil {
		return fmt.Errorf("write protected access token: %w", err)
	}
	return nil
}

// TokenProtocol returns the token subprotocol entry a WebSocket client
// offered, so the edge can select it when the guest selects none; clients that
// offer only this entry otherwise reject a handshake without a subprotocol.
func TokenProtocol(request *http.Request) string {
	for _, protocol := range webSocketProtocols(request.Header) {
		if strings.HasPrefix(protocol, AccessTokenProtocolPrefix) {
			return protocol
		}
	}
	return ""
}
