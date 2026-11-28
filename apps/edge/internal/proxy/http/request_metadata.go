// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"crypto/tls"
	"errors"
	"net"
	"net/http"
	"net/netip"
	"strings"

	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

type requestMetadata struct {
	source         netip.AddrPort
	scheme         string
	trustedProxy   bool
	originVerified bool
}

func resolveRequestMetadata(
	request *http.Request,
	snapshot *routes.Snapshot,
) (requestMetadata, error) {
	source, valid := proxy.SourceAddress(remoteAddress(request.RemoteAddr))
	if !valid {
		return requestMetadata{}, errors.New("invalid source address")
	}
	return resolveRequestMetadataWithTrust(
		request,
		source,
		snapshot.TrustsHTTPProxy(source.Addr()),
	)
}

func resolveRequestMetadataWithTrust(
	request *http.Request,
	source netip.AddrPort,
	trustedProxy bool,
) (requestMetadata, error) {
	metadata := requestMetadata{
		source:         source,
		scheme:         web.Scheme(request),
		trustedProxy:   trustedProxy,
		originVerified: hasVerifiedClientCertificate(request.TLS),
	}
	if !metadata.trustedProxy {
		return metadata, nil
	}
	clientAddress, err := netip.ParseAddr(
		strings.TrimSpace(request.Header.Get(web.CloudflareClientIP)),
	)
	if err != nil || clientAddress.Zone() != "" {
		return requestMetadata{}, errors.New(
			"trusted proxy provided an invalid client address",
		)
	}
	scheme := strings.ToLower(
		strings.TrimSpace(request.Header.Get(web.ForwardedProto)),
	)
	if scheme != web.SchemeHTTP && scheme != web.SchemeHTTPS {
		return requestMetadata{}, errors.New(
			"trusted proxy provided an invalid request scheme",
		)
	}
	metadata.source = netip.AddrPortFrom(clientAddress.Unmap(), 0)
	metadata.scheme = scheme
	return metadata, nil
}

func (metadata requestMetadata) isAuthenticatedOrigin() bool {
	return metadata.trustedProxy && metadata.originVerified
}

func hasVerifiedClientCertificate(state *tls.ConnectionState) bool {
	return state != nil && len(state.VerifiedChains) > 0
}

func remoteAddress(value string) net.Addr {
	address, err := net.ResolveTCPAddr("tcp", value)
	if err != nil {
		return stringAddress(value)
	}
	return address
}
