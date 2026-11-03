// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"context"
	"errors"
	"fmt"
)

func LoadIdentity(ctx context.Context, stateDirectory string) (identity *Identity, resultErr error) {
	database, err := openDatabaseReadOnly(ctx, stateDirectory)
	if err != nil {
		return nil, fmt.Errorf("open Snapflow state: %w", err)
	}
	defer func() {
		if closeErr := database.Close(ctx); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close Snapflow state: %w", closeErr))
		}
	}()
	vault, err := NewPlatformVault(stateDirectory)
	if err != nil {
		return nil, fmt.Errorf("open machine key vault: %w", err)
	}
	store, err := NewStore(StoreConfig{Database: database, Vault: vault})
	if err != nil {
		return nil, fmt.Errorf("initialize machine identity: %w", err)
	}
	identity, err = store.Load(ctx)
	if err != nil {
		return nil, fmt.Errorf("load machine identity: %w", err)
	}
	return identity, nil
}
