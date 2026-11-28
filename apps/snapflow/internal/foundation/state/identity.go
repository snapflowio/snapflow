// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	identitySingletonID   = 1
	identitySchemaVersion = 3
	identityKind          = "snapflow.machine.identity.v3"
	keyIDPrefix           = "ed25519:"
)

var (
	ErrNotRegistered            = errors.New("machine is not enrolled")
	ErrUnsupportedIdentityState = errors.New("machine identity has an unsupported schema")
	ErrIdentityKeyUnavailable   = errors.New("the machine keys can no longer be read on this system")
)

type Identity struct {
	APIURL         string
	MachineID      string
	OrganizationID string
	KeyID          string
	SigningKey     ed25519.PrivateKey
	HostKey        *HostKey
}

type identityEnvelope struct {
	SchemaVersion int    `json:"schemaVersion"`
	Kind          string `json:"kind"`
	SigningKey    string `json:"signingKey"`
	HostKey       string `json:"hostKey"`
}

type Store struct {
	database *Database
	vault    Vault
}

type StoreConfig struct {
	Database *Database
	Vault    Vault
}

func NewStore(cfg StoreConfig) (*Store, error) {
	if cfg.Database == nil || cfg.Database.sql == nil || cfg.Vault == nil {
		return nil, errors.New("machine identity database and key vault are required")
	}
	return &Store{database: cfg.Database, vault: cfg.Vault}, nil
}

type storedIdentity struct {
	identity    Identity
	hostAddress string
	backend     string
	reference   string
}

func (store *Store) Load(ctx context.Context) (*Identity, error) {
	stored, err := store.metadata(ctx)
	if err != nil {
		return nil, err
	}
	keys, err := store.keys(ctx, stored)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrIdentityKeyUnavailable, err)
	}
	value := stored.identity
	value.SigningKey, value.HostKey = keys.SigningKey, keys.HostKey
	if err := value.Validate(); err != nil {
		return nil, err
	}
	if value.HostKey.Address().Hex() != stored.hostAddress {
		return nil, errors.New("the machine host key does not match its enrolled address")
	}
	return &value, nil
}

func (store *Store) metadata(ctx context.Context) (storedIdentity, error) {
	var stored storedIdentity
	err := store.database.sql.QueryRowContext(ctx, `
		SELECT api_url, machine_id, organization_id, identity_key_id,
		       host_address, key_backend, key_reference
		FROM machine_identity WHERE singleton_id = ?
	`, identitySingletonID).Scan(
		&stored.identity.APIURL,
		&stored.identity.MachineID,
		&stored.identity.OrganizationID,
		&stored.identity.KeyID,
		&stored.hostAddress,
		&stored.backend,
		&stored.reference,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return storedIdentity{}, ErrNotRegistered
	}
	if err != nil {
		return storedIdentity{}, fmt.Errorf("load machine identity metadata: %w", err)
	}
	return stored, nil
}

func (store *Store) keys(ctx context.Context, stored storedIdentity) (EnrollmentKeys, error) {
	if stored.backend != store.vault.Backend() {
		return EnrollmentKeys{}, fmt.Errorf("machine key backend %q is unavailable", stored.backend)
	}
	payload, err := store.vault.Get(ctx, stored.reference)
	if err != nil {
		return EnrollmentKeys{}, err
	}
	var envelope identityEnvelope
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return EnrollmentKeys{}, fmt.Errorf("decode machine identity: %w", err)
	}
	if envelope.SchemaVersion != identitySchemaVersion || envelope.Kind != identityKind {
		return EnrollmentKeys{}, ErrUnsupportedIdentityState
	}
	signingKey, err := base64.RawStdEncoding.DecodeString(envelope.SigningKey)
	if err != nil || len(signingKey) != ed25519.PrivateKeySize {
		return EnrollmentKeys{}, errors.New("machine identity contains an invalid signing key")
	}
	hostKey, err := decodeHostKey(envelope.HostKey)
	if err != nil {
		return EnrollmentKeys{}, err
	}
	return EnrollmentKeys{SigningKey: ed25519.PrivateKey(signingKey), HostKey: hostKey}, nil
}

func (store *Store) Save(ctx context.Context, value *Identity) (resultErr error) {
	if err := value.Validate(); err != nil {
		return err
	}
	payload, err := json.Marshal(identityEnvelope{
		SchemaVersion: identitySchemaVersion,
		Kind:          identityKind,
		SigningKey:    base64.RawStdEncoding.EncodeToString(value.SigningKey),
		HostKey:       value.HostKey.encode(),
	})
	if err != nil {
		return fmt.Errorf("encode machine identity: %w", err)
	}
	reference, err := newKeyReference()
	if err != nil {
		return err
	}
	if err := store.vault.Put(ctx, reference, payload); err != nil {
		return err
	}
	previousReference, err := store.commitIdentity(ctx, value, reference)
	if err != nil {
		if cleanupErr := store.vault.Delete(context.WithoutCancel(ctx), reference); cleanupErr != nil {
			return errors.Join(err, fmt.Errorf("clean uncommitted machine identity: %w", cleanupErr))
		}
		return err
	}
	if previousReference != "" && previousReference != reference {
		if err := store.vault.Delete(context.WithoutCancel(ctx), previousReference); err != nil {
			return fmt.Errorf("delete superseded machine key: %w", err)
		}
	}
	return nil
}

func (store *Store) commitIdentity(ctx context.Context, value *Identity, reference string) (previousReference string, resultErr error) {
	transaction, err := store.database.sql.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("begin machine identity update: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := transaction.Rollback(); rollbackErr != nil && !errors.Is(rollbackErr, sql.ErrTxDone) {
			resultErr = errors.Join(resultErr, fmt.Errorf("rollback machine identity update: %w", rollbackErr))
		}
	}()
	loadErr := transaction.QueryRowContext(ctx, `
		SELECT key_reference
		FROM machine_identity WHERE singleton_id = ?
	`, identitySingletonID).Scan(
		&previousReference,
	)
	if loadErr != nil && !errors.Is(loadErr, sql.ErrNoRows) {
		return "", fmt.Errorf("load prior machine identity: %w", loadErr)
	}
	if _, err := transaction.ExecContext(ctx, `
		INSERT INTO machine_identity (
			singleton_id, api_url, machine_id, organization_id, identity_key_id,
			host_address, key_backend, key_reference, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(singleton_id) DO UPDATE SET
			api_url = excluded.api_url,
			machine_id = excluded.machine_id,
			organization_id = excluded.organization_id,
			identity_key_id = excluded.identity_key_id,
			host_address = excluded.host_address,
			key_backend = excluded.key_backend,
			key_reference = excluded.key_reference,
			updated_at = excluded.updated_at
	`, identitySingletonID, value.APIURL, value.MachineID, value.OrganizationID, value.KeyID,
		value.HostKey.Address().Hex(), store.vault.Backend(), reference,
		time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
		return "", fmt.Errorf("persist machine identity: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return "", fmt.Errorf("commit machine identity: %w", err)
	}
	committed = true
	return previousReference, nil
}

func (value *Identity) Validate() error {
	if value == nil {
		return errors.New("machine identity is required")
	}
	parsedURL, err := url.Parse(strings.TrimSpace(value.APIURL))
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" {
		return errors.New("the Snapflow API URL must be an absolute HTTP(S) URL")
	}
	if strings.TrimSpace(value.MachineID) == "" || strings.TrimSpace(value.OrganizationID) == "" {
		return errors.New("machine and organization IDs are required")
	}
	if len(value.SigningKey) != ed25519.PrivateKeySize {
		return errors.New("machine signing key is required")
	}
	if value.HostKey == nil {
		return errors.New("machine host key is required")
	}
	keyID, err := privateKeyID(value.SigningKey)
	if err != nil {
		return err
	}
	if keyID != value.KeyID {
		return errors.New("machine signing key does not match its registered key ID")
	}
	return nil
}

func NewIdentity(apiURL, machineID, organizationID string, keys EnrollmentKeys) (*Identity, error) {
	keyID, err := privateKeyID(keys.SigningKey)
	if err != nil {
		return nil, err
	}
	identity := &Identity{
		APIURL: apiURL, MachineID: machineID, OrganizationID: organizationID,
		KeyID: keyID, SigningKey: keys.SigningKey, HostKey: keys.HostKey,
	}
	if err := identity.Validate(); err != nil {
		return nil, err
	}
	return identity, nil
}

func (value *Identity) EnrollmentKeys() EnrollmentKeys {
	return EnrollmentKeys{SigningKey: value.SigningKey, HostKey: value.HostKey}
}

func GenerateSigningKey() (ed25519.PublicKey, ed25519.PrivateKey, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("generate machine signing key: %w", err)
	}
	return publicKey, privateKey, nil
}

func privateKeyID(privateKey ed25519.PrivateKey) (string, error) {
	if len(privateKey) != ed25519.PrivateKeySize {
		return "", errors.New("machine signing key is required")
	}
	publicKey, err := signingPublicKey(privateKey)
	if err != nil {
		return "", err
	}
	return KeyID(publicKey)
}

func KeyID(publicKey ed25519.PublicKey) (string, error) {
	der, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return "", fmt.Errorf("encode machine public key: %w", err)
	}
	digest := sha256.Sum256(der)
	return keyIDPrefix + hex.EncodeToString(digest[:]), nil
}

func PublicKeyPEM(publicKey ed25519.PublicKey) (string, error) {
	der, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return "", fmt.Errorf("encode machine public key: %w", err)
	}
	return "-----BEGIN PUBLIC KEY-----\n" +
		base64.StdEncoding.EncodeToString(der) +
		"\n-----END PUBLIC KEY-----\n", nil
}

func (value *Identity) SignPayload(payload []byte) (string, error) {
	if err := value.Validate(); err != nil {
		return "", err
	}
	if len(payload) == 0 {
		return "", errors.New("machine signing payload is required")
	}
	return base64.RawURLEncoding.EncodeToString(ed25519.Sign(value.SigningKey, payload)), nil
}
