// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package imagecache

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"slices"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/snapflowio/microvm-go/internal/netrules"
)

const (
	registryDialTimeout   = 30 * time.Second
	registryDialKeepAlive = 30 * time.Second
)

var ErrRegistryAddressRefused = errors.New("registry address is not public")

type RegistryGuard struct {
	trusted []string
	mu      sync.RWMutex
	denied  []netip.Addr
}

func NewRegistryGuard(trustedHosts ...string) *RegistryGuard {
	trusted := make([]string, 0, len(trustedHosts))
	for _, host := range trustedHosts {
		if host = strings.ToLower(strings.TrimSpace(host)); host != "" {
			trusted = append(trusted, host)
		}
	}
	return &RegistryGuard{trusted: trusted}
}

func (g *RegistryGuard) Deny(addresses []netip.Addr) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.denied = slices.Clone(addresses)
}

func (g *RegistryGuard) trusts(address string) bool {
	candidates := []string{strings.ToLower(address)}
	if host, _, err := net.SplitHostPort(address); err == nil {
		candidates = append(candidates, strings.ToLower(host))
	}
	return slices.ContainsFunc(g.trusted, func(trusted string) bool {
		return slices.Contains(candidates, trusted)
	})
}

func (g *RegistryGuard) refuses(address netip.Addr) bool {
	address = address.Unmap()
	if !address.IsGlobalUnicast() || address.IsPrivate() {
		return true
	}
	if address.Is4() && slices.ContainsFunc(netrules.ProtectedDestinations(), func(prefix netip.Prefix) bool {
		return prefix.Contains(address)
	}) {
		return true
	}
	g.mu.RLock()
	defer g.mu.RUnlock()
	return slices.Contains(g.denied, address)
}

func (g *RegistryGuard) control(_, address string, _ syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("parse registry dial address %q: %w", address, err)
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return fmt.Errorf("parse registry dial address %q: %w", address, err)
	}
	if g.refuses(ip) {
		return fmt.Errorf("%w: %s", ErrRegistryAddressRefused, ip)
	}
	return nil
}

func (g *RegistryGuard) transport() http.RoundTripper {
	transport := &http.Transport{Proxy: http.ProxyFromEnvironment}
	if base, ok := remote.DefaultTransport.(*http.Transport); ok {
		transport = base.Clone()
	}
	open := &net.Dialer{Timeout: registryDialTimeout, KeepAlive: registryDialKeepAlive}
	guarded := &net.Dialer{Timeout: registryDialTimeout, KeepAlive: registryDialKeepAlive, Control: g.control}
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		if g.trusts(address) {
			return open.DialContext(ctx, network, address)
		}
		return guarded.DialContext(ctx, network, address)
	}
	return transport
}
