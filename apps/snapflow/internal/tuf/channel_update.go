// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"crypto/ed25519"
	"time"

	"github.com/theupdateframework/go-tuf/v2/metadata"
)

// channelUpdate is an opened repository with a verified trust chain and the
// keys that re-sign one channel role and the online roles.
type channelUpdate struct {
	repository repositoryPaths
	chain      *trustedChain
	channel    Channel
	role       *metadata.Metadata[metadata.TargetsType]
	roleKeys   []ed25519.PrivateKey
	keys       onlineKeys
	now        time.Time
}

type channelUpdateConfig struct {
	repositoryRoot string
	channel        Channel
	roleKeys       []string
	snapshotKey    string
	timestampKey   string
	now            time.Time
}

func openChannelUpdate(cfg channelUpdateConfig) (*channelUpdate, error) {
	repository, err := openRepository(cfg.repositoryRoot)
	if err != nil {
		return nil, err
	}
	roleKeys, err := loadKeys(string(cfg.channel), cfg.roleKeys...)
	if err != nil {
		return nil, err
	}
	keys, err := loadOnlineKeys(cfg.snapshotKey, cfg.timestampKey)
	if err != nil {
		return nil, err
	}
	now := cfg.now.UTC()
	chain, err := loadTrustedChain(repository.metadata, now)
	if err != nil {
		return nil, err
	}
	role, err := chain.channel(cfg.channel)
	if err != nil {
		return nil, err
	}
	return &channelUpdate{
		repository: repository, chain: chain, channel: cfg.channel,
		role: role, roleKeys: roleKeys, keys: keys, now: now,
	}, nil
}

// apply points the channel at selected for its architecture. It reports
// false without writing when the channel already offers exactly that release,
// and refuses to move the channel back to an older or equal version.
func (update *channelUpdate) apply(selected ChannelRelease) (bool, error) {
	current, found, err := readChannelRelease(update.repository.targets, update.role, update.channel, selected.Architecture)
	if err != nil {
		return false, err
	}
	if found && current == selected {
		return false, nil
	}
	if err := requireAdvance(update.repository.targets, update.role, selected); err != nil {
		return false, err
	}
	if err := writeChannelRelease(update.repository.targets, update.role, selected); err != nil {
		return false, err
	}
	return true, nil
}

// sign re-signs the channel role, then snapshot and timestamp over it.
func (update *channelUpdate) sign() error {
	if err := update.chain.signChannel(update.repository.metadata, update.channel, update.roleKeys, update.now); err != nil {
		return err
	}
	return update.chain.commit(update.repository.metadata, update.keys, update.now)
}
