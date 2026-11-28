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

func tokenBackend(token string) (uuid.UUID, bool) {
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != tokenSignedBytes || decoded[tokenVersionOffset] != tokenVersion {
		return uuid.Nil, false
	}
	backendID, err := uuid.FromBytes(decoded[tokenBackendOffset:tokenSessionOffset])
	return backendID, err == nil
}

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

func TokenProtocol(request *http.Request) string {
	for _, protocol := range webSocketProtocols(request.Header) {
		if strings.HasPrefix(protocol, AccessTokenProtocolPrefix) {
			return protocol
		}
	}
	return ""
}
