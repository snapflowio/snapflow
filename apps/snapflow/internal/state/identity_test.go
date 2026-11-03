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
	"path/filepath"
	"sync"
	"testing"
)

const (
	testVaultBackend   = "memory"
	testIdentityAPIURL = "https://api.snapflow.io/api"
	testIdentityID     = "7acbe734-7bba-4571-b30e-0b823381aaec"
	testIdentityOwner  = "6b26f3ed-55b9-4d37-a23e-da19a5818dc7"
)

var errVaultKeyChanged = errors.New("decryption failed")

type memoryVault struct {
	mu      sync.Mutex
	entries map[string][]byte
	broken  bool
}

func (vault *memoryVault) Backend() string { return testVaultBackend }

func (vault *memoryVault) Put(ctx context.Context, reference string, payload []byte) error {
	vault.mu.Lock()
	defer vault.mu.Unlock()
	vault.entries[reference] = payload
	return ctx.Err()
}

func (vault *memoryVault) Get(ctx context.Context, reference string) ([]byte, error) {
	vault.mu.Lock()
	defer vault.mu.Unlock()
	if vault.broken {
		return nil, errVaultKeyChanged
	}
	return vault.entries[reference], ctx.Err()
}

func (vault *memoryVault) Delete(ctx context.Context, reference string) error {
	vault.mu.Lock()
	defer vault.mu.Unlock()
	delete(vault.entries, reference)
	return ctx.Err()
}

func savedIdentityStore(t *testing.T) (*Store, *memoryVault) {
	t.Helper()
	database, err := OpenDatabase(t.Context(), filepath.Join(t.TempDir(), "machine"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := database.Close(context.WithoutCancel(t.Context())); err != nil {
			t.Error(err)
		}
	})
	vault := &memoryVault{entries: map[string][]byte{}}
	store, err := NewStore(StoreConfig{Database: database, Vault: vault})
	if err != nil {
		t.Fatal(err)
	}
	publicKey, privateKey, err := GenerateSigningKey()
	if err != nil {
		t.Fatal(err)
	}
	keyID, err := KeyID(publicKey)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Save(t.Context(), &Identity{
		APIURL: testIdentityAPIURL, MachineID: testIdentityID, OwnerID: testIdentityOwner,
		KeyID: keyID, SigningKey: privateKey,
	}); err != nil {
		t.Fatal(err)
	}
	return store, vault
}

func TestLoadReturnsTheSavedIdentity(t *testing.T) {
	store, _ := savedIdentityStore(t)
	identity, err := store.Load(t.Context())
	if err != nil || identity.MachineID != testIdentityID || len(identity.SigningKey) == 0 {
		t.Fatalf("identity = %+v, %v", identity, err)
	}
}

func TestUnreadableSigningKeysAreReportedAsUnavailable(t *testing.T) {
	store, vault := savedIdentityStore(t)
	vault.broken = true
	identity, err := store.Load(t.Context())
	if !errors.Is(err, ErrIdentityKeyUnavailable) || !errors.Is(err, errVaultKeyChanged) || identity != nil {
		t.Fatalf("identity = %+v, %v; want an unavailable signing key", identity, err)
	}
}

func TestMetadataStaysReadableWhenTheSigningKeyIsNot(t *testing.T) {
	store, vault := savedIdentityStore(t)
	vault.broken = true
	identity, err := store.Metadata(t.Context())
	if err != nil || identity.MachineID != testIdentityID || identity.OwnerID != testIdentityOwner || identity.SigningKey != nil {
		t.Fatalf("metadata = %+v, %v", identity, err)
	}
}
