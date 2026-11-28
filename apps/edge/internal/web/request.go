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
	websocketProtocol = "websocket"
	upgradeToken      = "upgrade"
	tokenSeparator    = ","
)

func ContainsToken(values []string, expected string) bool {
	for _, value := range values {
		for token := range strings.SplitSeq(value, tokenSeparator) {
			if strings.EqualFold(strings.TrimSpace(token), expected) {
				return true
			}
		}
	}
	return false
}

func IsWebSocketUpgrade(request *http.Request) bool {
	return strings.EqualFold(request.Header.Get(Upgrade), websocketProtocol) &&
		ContainsToken(request.Header.Values(Connection), upgradeToken)
}

func Scheme(request *http.Request) string {
	if request.TLS != nil {
		return SchemeHTTPS
	}
	return SchemeHTTP
}

func IsSameOrigin(request *http.Request) bool {
	originValue := strings.TrimSpace(request.Header.Get(Origin))
	if originValue == "" {
		return false
	}
	origin, err := url.Parse(originValue)
	if err != nil || origin.Host == "" || origin.User != nil {
		return false
	}
	return strings.EqualFold(origin.Scheme, Scheme(request)) &&
		strings.EqualFold(origin.Host, request.Host)
}
