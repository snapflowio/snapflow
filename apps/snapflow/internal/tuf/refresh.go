// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/theupdateframework/go-tuf/v2/metadata"
)

// refreshValidityDivisor re-signs a role once less than 1/refreshValidityDivisor
// of its validity remains, so it never lapses between scheduled refreshes.
const refreshValidityDivisor = 2

type RefreshConfig struct {
	RepositoryRoot string
	ChannelKeys    map[Channel]string
	SnapshotKey    string
	TimestampKey   string
	Now            time.Time
}

type ExpiryConfig struct {
	RepositoryRoot string
	Within         time.Duration
	Now            time.Time
}

type RoleExpiry struct {
	Role    string    `json:"role"`
	Expires time.Time `json:"expires"`
}

func Refresh(cfg RefreshConfig) error {
	if cfg.Now.IsZero() {
		return errors.New("release TUF refresh time is required")
	}
	repository, err := openRepository(cfg.RepositoryRoot)
	if err != nil {
		return err
	}
	keys, err := loadOnlineKeys(cfg.SnapshotKey, cfg.TimestampKey)
	if err != nil {
		return err
	}
	now := cfg.Now.UTC()
	chain, err := loadTrustedChain(repository.metadata, now)
	if err != nil {
		return err
	}
	resigned, err := chain.refreshChannels(repository.metadata, cfg.ChannelKeys, now)
	if err != nil {
		return err
	}
	if resigned || refreshDue(chain.snapshot.Signed.Expires, now, snapshotValidity) {
		return chain.commit(repository.metadata, keys, now)
	}
	return chain.commitTimestamp(repository.metadata, keys.timestamp, now)
}

func (chain *trustedChain) refreshChannels(metadataRoot string, channelKeys map[Channel]string, now time.Time) (bool, error) {
	resigned := false
	for channel, keyPath := range channelKeys {
		role, err := chain.channel(channel)
		if err != nil {
			return false, err
		}
		if !refreshDue(role.Signed.Expires, now, channelValidity) {
			continue
		}
		roleKeys, err := loadKeys(string(channel), keyPath)
		if err != nil {
			return false, err
		}
		if err := chain.signChannel(metadataRoot, channel, roleKeys, now); err != nil {
			return false, err
		}
		resigned = true
	}
	return resigned, nil
}

func refreshDue(expires, now time.Time, validity time.Duration) bool {
	return expires.Before(now.Add(validity / refreshValidityDivisor))
}

func CheckExpiry(cfg ExpiryConfig) ([]RoleExpiry, error) {
	if cfg.Now.IsZero() || cfg.Within <= 0 {
		return nil, errors.New("release TUF expiry check needs a time and a positive window")
	}
	repository, err := openRepository(cfg.RepositoryRoot)
	if err != nil {
		return nil, err
	}
	now := cfg.Now.UTC()
	chain, err := loadTrustedChain(repository.metadata, now)
	if err != nil {
		return nil, err
	}
	roles := []RoleExpiry{
		{Role: metadata.ROOT, Expires: chain.root.Signed.Expires},
		{Role: metadata.TARGETS, Expires: chain.targets.Signed.Expires},
		{Role: metadata.SNAPSHOT, Expires: chain.snapshot.Signed.Expires},
		{Role: metadata.TIMESTAMP, Expires: chain.timestamp.Signed.Expires},
	}
	for name, role := range chain.roles {
		roles = append(roles, RoleExpiry{Role: name, Expires: role.Signed.Expires})
	}
	slices.SortFunc(roles, func(left, right RoleExpiry) int { return left.Expires.Compare(right.Expires) })
	deadline := now.Add(cfg.Within)
	expiring := []string{}
	for _, role := range roles {
		online := role.Role == metadata.SNAPSHOT || role.Role == metadata.TIMESTAMP
		if role.Expires.Before(now) || (!online && role.Expires.Before(deadline)) {
			expiring = append(expiring, fmt.Sprintf("%s (%s)", role.Role, role.Expires.Format(time.RFC3339)))
		}
	}
	if len(expiring) > 0 {
		return roles, fmt.Errorf("release TUF metadata needs re-signing: %s", strings.Join(expiring, ", "))
	}
	return roles, nil
}
