// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package passthrough

import (
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"slices"
	"strings"

	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	hostListSeparator = ","
	maxOriginHosts    = 32
)

var hostnamePattern = regexp.MustCompile(`^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$`)

type Config struct {
	Site  string
	Hosts []string
}

func (config Config) Enabled() bool {
	return config.Site != ""
}

func ParseHosts(value string) []string {
	var hosts []string
	for host := range strings.SplitSeq(value, hostListSeparator) {
		normalized := normalizeHost(host)
		if normalized != "" && !slices.Contains(hosts, normalized) {
			hosts = append(hosts, normalized)
		}
	}
	return hosts
}

func (config Config) Validate() error {
	if !config.Enabled() {
		if len(config.Hosts) != 0 {
			return errors.New("origin hosts need an origin site")
		}
		return nil
	}
	if err := protocol.ValidateOriginSite(config.Site); err != nil {
		return err
	}
	if len(config.Hosts) == 0 || len(config.Hosts) > maxOriginHosts {
		return fmt.Errorf("an origin site needs 1-%d origin hosts", maxOriginHosts)
	}
	for _, host := range config.Hosts {
		if len(host) > protocol.MaxServerNameLength || !hostnamePattern.MatchString(host) {
			return fmt.Errorf("origin host %q must be a lowercase DNS name without a wildcard", host)
		}
	}
	return nil
}

type options struct {
	logger *slog.Logger
}

type Option func(*options)

func WithLogger(logger *slog.Logger) Option {
	return func(configured *options) {
		configured.logger = logger
	}
}

func newOptions(opts []Option) options {
	configured := options{logger: slog.Default()}
	for _, apply := range opts {
		apply(&configured)
	}
	return configured
}
