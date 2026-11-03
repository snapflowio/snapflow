// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build !linux

package state

import (
	"context"
	"fmt"

	"github.com/zalando/go-keyring"
)

const keyringService = "Snapflow"

type keyringVault struct{}

func NewPlatformVault(string) (Vault, error) { return &keyringVault{}, nil }

func (*keyringVault) Backend() string { return "os-credential-manager" }

func (*keyringVault) Put(ctx context.Context, reference string, payload []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := validateKeyReference(reference); err != nil {
		return err
	}
	if err := keyring.Set(keyringService, reference, string(payload)); err != nil {
		return fmt.Errorf("store machine credential: %w", err)
	}
	return nil
}

func (*keyringVault) Get(ctx context.Context, reference string) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := validateKeyReference(reference); err != nil {
		return nil, err
	}
	payload, err := keyring.Get(keyringService, reference)
	if err != nil {
		return nil, fmt.Errorf("read machine credential: %w", err)
	}
	return []byte(payload), nil
}

func (*keyringVault) Delete(ctx context.Context, reference string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := validateKeyReference(reference); err != nil {
		return err
	}
	if err := keyring.Delete(keyringService, reference); err != nil && err != keyring.ErrNotFound {
		return fmt.Errorf("delete machine credential: %w", err)
	}
	return nil
}
