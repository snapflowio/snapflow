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

package runtime

import (
	"context"
	"errors"
	"fmt"
	"net/netip"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/guest/control"
	"github.com/snapflowio/microvm-go/internal/guestcontrol"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

const (
	linkedPeerUpdateTimeout = 10 * time.Second
	aliasIDLength           = 12
	maxDNSLabelLength       = 63
)

var nonDNSLabelCharacters = regexp.MustCompile(`[^a-z0-9-]+`)

func (b *Backend) establishLinkedPeer(
	ctx context.Context,
	child *state.InstanceMetadata,
	record imagecache.ImageRecord,
) (func(context.Context) error, error) {
	peerID := child.RawRequest.LinkedPeerID
	if peerID == "" {
		return nil, nil
	}
	parent, err := b.readLinkablePeer(ctx, peerID, *child)
	if err != nil {
		return nil, err
	}

	previousParent := parent
	child.LinkedPeer = &state.LinkedPeerMetadata{
		InstanceID:     parent.ID,
		TransitAddress: parent.Network.TransitSandbox,
		Aliases:        networkAliases(parent.RawRequest.NetworkName, parent.ID),
	}
	parent.LinkedPeer = &state.LinkedPeerMetadata{
		InstanceID:     child.ID,
		TransitAddress: child.Network.TransitSandbox,
		Aliases:        networkAliases(child.RawRequest.NetworkName, child.ID),
	}

	rollback := func(rollbackCtx context.Context) error {
		return b.restoreLinkedPeer(rollbackCtx, previousParent, *child)
	}
	if err := b.allowLinkFromChild(ctx, *child, record); err != nil {
		child.LinkedPeer = nil
		return nil, err
	}
	if err := b.commitLinkToParent(ctx, parent, *child); err != nil {
		return nil, errors.Join(err, rollback(context.WithoutCancel(ctx)))
	}
	return rollback, nil
}

func (b *Backend) readLinkablePeer(ctx context.Context, peerID string, child state.InstanceMetadata) (state.InstanceMetadata, error) {
	parent, err := state.ReadInstanceMetadata(b.paths, peerID)
	if err != nil {
		return state.InstanceMetadata{}, fmt.Errorf("read linked peer %s: %w", peerID, err)
	}
	if parent.State != types.RuntimeStateStarted || !b.processRunning(ctx, parent) || !instanceHasNetwork(parent) {
		return state.InstanceMetadata{}, fmt.Errorf("linked peer %s must be running with an active network", peerID)
	}
	if parent.LinkedPeer != nil {
		return state.InstanceMetadata{}, fmt.Errorf("linked peer %s is already linked to %s", peerID, parent.LinkedPeer.InstanceID)
	}
	if !instanceHasNetwork(child) {
		return state.InstanceMetadata{}, errors.New("linked instance requires an active network")
	}
	if _, err := netip.ParseAddr(parent.Network.TransitSandbox); err != nil {
		return state.InstanceMetadata{}, fmt.Errorf("validate linked peer transit address: %w", err)
	}
	if _, err := netip.ParseAddr(child.Network.TransitSandbox); err != nil {
		return state.InstanceMetadata{}, fmt.Errorf("validate linked instance transit address: %w", err)
	}
	return parent, nil
}

func (b *Backend) allowLinkFromChild(ctx context.Context, child state.InstanceMetadata, record imagecache.ImageRecord) error {
	if err := b.writeInstanceConfigDrive(child, record); err != nil {
		return fmt.Errorf("write linked instance config drive: %w", err)
	}
	childPolicy, err := instanceEgressPolicy(child)
	if err != nil {
		return err
	}
	if err := b.networks.ApplyEgressPolicy(ctx, instancePolicyBinding(child, childPolicy)); err != nil {
		return fmt.Errorf("allow linked peer from child: %w", err)
	}
	return nil
}

func (b *Backend) commitLinkToParent(ctx context.Context, parent, child state.InstanceMetadata) error {
	parentPolicy, err := instanceEgressPolicy(parent)
	if err != nil {
		return err
	}
	if err := b.networks.ApplyEgressPolicy(ctx, instancePolicyBinding(parent, parentPolicy)); err != nil {
		return fmt.Errorf("allow linked peer from parent: %w", err)
	}
	if err := b.writeInstance(child); err != nil {
		return fmt.Errorf("persist linked child: %w", err)
	}
	if err := b.writeInstance(parent); err != nil {
		return fmt.Errorf("persist linked parent: %w", err)
	}
	if err := b.applyGuestHosts(ctx, parent); err != nil {
		return fmt.Errorf("configure linked parent name resolution: %w", err)
	}
	return nil
}

func (b *Backend) restoreLinkedPeer(ctx context.Context, parent, child state.InstanceMetadata) error {
	child.LinkedPeer = nil
	parent.LinkedPeer = nil
	childPolicy, childPolicyErr := instanceEgressPolicy(child)
	if childPolicyErr == nil {
		childPolicyErr = b.networks.ApplyEgressPolicy(ctx, instancePolicyBinding(child, childPolicy))
	}
	parentPolicy, parentPolicyErr := instanceEgressPolicy(parent)
	if parentPolicyErr == nil {
		parentPolicyErr = b.networks.ApplyEgressPolicy(ctx, instancePolicyBinding(parent, parentPolicy))
	}
	return errors.Join(
		wrapOptionalError("restore child network policy", childPolicyErr),
		wrapOptionalError("restore parent network policy", parentPolicyErr),
		wrapOptionalError("clear linked parent hosts", b.applyGuestHosts(ctx, parent)),
		wrapOptionalError("restore linked parent metadata", b.writeInstance(parent)),
	)
}

func (b *Backend) detachLinkedPeer(ctx context.Context, target *state.InstanceMetadata) error {
	if target.LinkedPeer == nil {
		return nil
	}
	peer, err := state.ReadInstanceMetadata(b.paths, target.LinkedPeer.InstanceID)
	if err != nil {
		return fmt.Errorf("read linked peer before detach: %w", err)
	}
	if peer.LinkedPeer == nil || peer.LinkedPeer.InstanceID != target.ID {
		return errors.New("linked peer metadata is not reciprocal")
	}
	previousPeer := peer
	peer.LinkedPeer = nil
	policy, err := instanceEgressPolicy(peer)
	if err != nil {
		return err
	}
	if err := b.networks.ApplyEgressPolicy(ctx, instancePolicyBinding(peer, policy)); err != nil {
		return fmt.Errorf("remove detached peer network permission: %w", err)
	}
	if peer.State == types.RuntimeStateStarted && b.processRunning(ctx, peer) {
		if err := b.applyGuestHosts(ctx, peer); err != nil {
			rollbackPolicy, policyErr := instanceEgressPolicy(previousPeer)
			if policyErr == nil {
				policyErr = b.networks.ApplyEgressPolicy(context.WithoutCancel(ctx), instancePolicyBinding(previousPeer, rollbackPolicy))
			}
			return errors.Join(
				fmt.Errorf("remove detached peer name mapping: %w", err),
				wrapOptionalError("restore linked peer network permission", policyErr),
			)
		}
	}
	if err := b.writeInstance(peer); err != nil {
		return fmt.Errorf("persist detached peer: %w", err)
	}
	target.LinkedPeer = nil
	return nil
}

func ensureInstanceNotLinked(metadata state.InstanceMetadata, operation string) error {
	if metadata.LinkedPeer == nil {
		return nil
	}
	return fmt.Errorf("cannot %s instance while it is linked to %s", operation, metadata.LinkedPeer.InstanceID)
}

func (b *Backend) applyGuestHosts(ctx context.Context, metadata state.InstanceMetadata) error {
	if metadata.State != types.RuntimeStateStarted || !b.processRunning(ctx, metadata) {
		return errors.New("linked guest is not running")
	}
	client, err := guestcontrol.NewClient(metadata.VsockSocket, metadata.ControlAuthToken)
	if err != nil {
		return err
	}
	defer client.Close()
	var entries []control.HostEntry
	if metadata.LinkedPeer != nil {
		entries = []control.HostEntry{{
			Address: metadata.LinkedPeer.TransitAddress,
			Aliases: append([]string(nil), metadata.LinkedPeer.Aliases...),
		}}
	}
	updateCtx, cancel := context.WithTimeout(ctx, linkedPeerUpdateTimeout)
	defer cancel()
	return client.ApplyHosts(updateCtx, entries)
}

func networkAliases(name, instanceID string) []string {
	compactID := strings.ReplaceAll(instanceID, "-", "")
	if uuid.Validate(instanceID) != nil || len(compactID) < aliasIDLength {
		compactID = "unknown"
	}
	stable := "sandbox-" + compactID[:min(len(compactID), aliasIDLength)] + ".internal"
	slug := strings.ToLower(strings.TrimSpace(name))
	slug = nonDNSLabelCharacters.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if len(slug) > maxDNSLabelLength {
		slug = strings.TrimRight(slug[:maxDNSLabelLength], "-")
	}
	if slug == "" || slug == "localhost" {
		return []string{stable}
	}
	return []string{slug, slug + ".sandbox", stable}
}
