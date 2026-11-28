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

package control

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/netip"
	"os"
	"regexp"
	"slices"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

const (
	managedHostsPath   = "/etc/hosts"
	managedHostsStart  = "# snapflow-managed-hosts: begin"
	managedHostsEnd    = "# snapflow-managed-hosts: end"
	maxManagedHosts    = 8
	maxHostAliases     = 4
	maxHostAliasLength = 253
)

var hostAliasPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$`)

func (s *Server) applyHosts(c *echo.Context) error {
	request := ApplyHostsRequest{}
	decoder := json.NewDecoder(http.MaxBytesReader(c.Response(), c.Request().Body, maxHostsRequestBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		return writeProblem(c, http.StatusBadRequest, "HOSTS_INVALID", "Managed hosts request is invalid", false, nil)
	}
	if err := ValidateHostEntries(request.Entries); err != nil {
		return writeProblem(c, http.StatusBadRequest, "HOSTS_INVALID", "Managed hosts request is invalid", false, nil)
	}
	if err := WriteManagedHosts(managedHostsPath, request.Entries); err != nil {
		return internalError(fmt.Errorf("apply managed hosts: %w", err))
	}
	return c.NoContent(http.StatusNoContent)
}

func ValidateHostEntries(entries []HostEntry) error {
	if len(entries) > maxManagedHosts {
		return fmt.Errorf("managed hosts exceeds %d entries", maxManagedHosts)
	}
	seenAliases := make(map[string]struct{})
	for _, entry := range entries {
		if err := validateHostEntry(entry, seenAliases); err != nil {
			return err
		}
	}
	return nil
}

func validateHostEntry(entry HostEntry, seenAliases map[string]struct{}) error {
	address, err := netip.ParseAddr(entry.Address)
	if err != nil || !address.Is4() {
		return fmt.Errorf("managed host address %q is not IPv4", entry.Address)
	}
	if len(entry.Aliases) == 0 || len(entry.Aliases) > maxHostAliases {
		return fmt.Errorf("managed host must contain between one and %d aliases", maxHostAliases)
	}
	for _, alias := range entry.Aliases {
		if len(alias) > maxHostAliasLength || !hostAliasPattern.MatchString(alias) {
			return fmt.Errorf("managed host alias %q is invalid", alias)
		}
		if _, exists := seenAliases[alias]; exists {
			return fmt.Errorf("managed host alias %q is duplicated", alias)
		}
		seenAliases[alias] = struct{}{}
	}
	return nil
}

func WriteManagedHosts(path string, entries []HostEntry) error {
	if err := ValidateHostEntries(entries); err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("read hosts file: %w", err)
	}
	base, err := removeManagedHostsBlock(string(data))
	if err != nil {
		return err
	}
	var builder strings.Builder
	builder.WriteString(strings.TrimRight(base, "\n"))
	builder.WriteByte('\n')
	if len(entries) > 0 {
		builder.WriteString(managedHostsStart)
		builder.WriteByte('\n')
		entries = slices.Clone(entries)
		slices.SortFunc(entries, func(left, right HostEntry) int { return strings.Compare(left.Address, right.Address) })
		for _, entry := range entries {
			builder.WriteString(entry.Address)
			builder.WriteByte('\t')
			builder.WriteString(strings.Join(entry.Aliases, " "))
			builder.WriteByte('\n')
		}
		builder.WriteString(managedHostsEnd)
		builder.WriteByte('\n')
	}
	if err := atomicfile.Replace(path, []byte(builder.String()), filemode.SharedFile); err != nil {
		return err
	}
	return atomicfile.Commit(path)
}

func removeManagedHostsBlock(contents string) (string, error) {
	var builder strings.Builder
	scanner := bufio.NewScanner(strings.NewReader(contents))
	inManagedBlock := false
	seenManagedBlock := false
	for scanner.Scan() {
		line := scanner.Text()
		switch line {
		case managedHostsStart:
			if inManagedBlock || seenManagedBlock {
				return "", errors.New("hosts file contains an invalid managed block")
			}
			inManagedBlock = true
			seenManagedBlock = true
		case managedHostsEnd:
			if !inManagedBlock {
				return "", errors.New("hosts file contains an unmatched managed block terminator")
			}
			inManagedBlock = false
		default:
			if !inManagedBlock {
				builder.WriteString(line)
				builder.WriteByte('\n')
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("scan hosts file: %w", err)
	}
	if inManagedBlock {
		return "", errors.New("hosts file contains an unterminated managed block")
	}
	return builder.String(), nil
}
