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
	identitySingletonID            = 1
	identitySchemaVersion          = 2
	identityKind                   = "snapflow.machine.identity.v2"
	keyIDPrefix                    = "ed25519:"
	registrationProofDomain        = "snapflow.machine-registration"
	registrationProofLineSeparator = "\n"
	registrationNonceBytes         = 24
	registrationProofTimePrecision = time.Millisecond
)

var (
	ErrNotRegistered            = errors.New("machine is not registered")
	ErrUnsupportedIdentityState = errors.New("machine identity has an unsupported schema")
	ErrIdentityKeyUnavailable   = errors.New("the machine signing key can no longer be read on this system")
)

type Identity struct {
	APIURL     string
	MachineID  string
	OwnerID    string
	KeyID      string
	SigningKey ed25519.PrivateKey
}

type identityEnvelope struct {
	SchemaVersion int    `json:"schemaVersion"`
	Kind          string `json:"kind"`
	SigningKey    string `json:"signingKey"`
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

func (store *Store) Load(ctx context.Context) (*Identity, error) {
	value, key, err := store.metadata(ctx)
	if err != nil {
		return nil, err
	}
	signingKey, err := store.signingKey(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrIdentityKeyUnavailable, err)
	}
	value.SigningKey = signingKey
	if err := value.Validate(); err != nil {
		return nil, err
	}
	return value, nil
}

func (store *Store) Metadata(ctx context.Context) (*Identity, error) {
	value, _, err := store.metadata(ctx)
	return value, err
}

type storedKey struct {
	backend   string
	reference string
}

func (store *Store) metadata(ctx context.Context) (*Identity, storedKey, error) {
	var value Identity
	var key storedKey
	err := store.database.sql.QueryRowContext(ctx, `
		SELECT api_url, machine_id, owner_id, identity_key_id,
		       key_backend, key_reference
		FROM machine_identity WHERE singleton_id = ?
	`, identitySingletonID).Scan(
		&value.APIURL,
		&value.MachineID,
		&value.OwnerID,
		&value.KeyID,
		&key.backend,
		&key.reference,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, storedKey{}, ErrNotRegistered
	}
	if err != nil {
		return nil, storedKey{}, fmt.Errorf("load machine identity metadata: %w", err)
	}
	return &value, key, nil
}

func (store *Store) signingKey(ctx context.Context, key storedKey) (ed25519.PrivateKey, error) {
	if key.backend != store.vault.Backend() {
		return nil, fmt.Errorf("machine key backend %q is unavailable", key.backend)
	}
	payload, err := store.vault.Get(ctx, key.reference)
	if err != nil {
		return nil, err
	}
	var identity identityEnvelope
	if err := json.Unmarshal(payload, &identity); err != nil {
		return nil, fmt.Errorf("decode machine identity: %w", err)
	}
	if identity.SchemaVersion != identitySchemaVersion || identity.Kind != identityKind {
		return nil, ErrUnsupportedIdentityState
	}
	privateKey, err := base64.RawStdEncoding.DecodeString(identity.SigningKey)
	if err != nil || len(privateKey) != ed25519.PrivateKeySize {
		return nil, errors.New("machine identity contains an invalid signing key")
	}
	return ed25519.PrivateKey(privateKey), nil
}

func (store *Store) Save(ctx context.Context, value *Identity) (resultErr error) {
	if err := value.Validate(); err != nil {
		return err
	}
	payload, err := json.Marshal(identityEnvelope{
		SchemaVersion: identitySchemaVersion,
		Kind:          identityKind,
		SigningKey:    base64.RawStdEncoding.EncodeToString(value.SigningKey),
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
			singleton_id, api_url, machine_id, owner_id, identity_key_id,
			key_backend, key_reference, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(singleton_id) DO UPDATE SET
			api_url = excluded.api_url,
			machine_id = excluded.machine_id,
			owner_id = excluded.owner_id,
			identity_key_id = excluded.identity_key_id,
			key_backend = excluded.key_backend,
			key_reference = excluded.key_reference,
			updated_at = excluded.updated_at
	`, identitySingletonID, value.APIURL, value.MachineID, value.OwnerID, value.KeyID,
		store.vault.Backend(), reference, time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
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
	if strings.TrimSpace(value.MachineID) == "" || strings.TrimSpace(value.OwnerID) == "" {
		return errors.New("machine and owner IDs are required")
	}
	if len(value.SigningKey) != ed25519.PrivateKeySize {
		return errors.New("machine signing key is required")
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

func GenerateSigningKey() (ed25519.PublicKey, ed25519.PrivateKey, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("generate machine signing key: %w", err)
	}
	return publicKey, privateKey, nil
}

func privateKeyID(privateKey ed25519.PrivateKey) (string, error) {
	publicKey, ok := privateKey.Public().(ed25519.PublicKey)
	if !ok {
		return "", errors.New("machine signing key has no Ed25519 public key")
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

type RegistrationProof struct {
	IssuedAt  time.Time
	Nonce     string
	Signature string
}

func SignRegistration(name string, privateKey ed25519.PrivateKey, now time.Time) (RegistrationProof, error) {
	nonce := make([]byte, registrationNonceBytes)
	if _, err := rand.Read(nonce); err != nil {
		return RegistrationProof{}, fmt.Errorf("generate machine registration nonce: %w", err)
	}
	return signRegistration(name, privateKey, now.UTC().Truncate(registrationProofTimePrecision),
		base64.RawURLEncoding.EncodeToString(nonce))
}

func signRegistration(name string, privateKey ed25519.PrivateKey, issuedAt time.Time, nonce string) (RegistrationProof, error) {
	if strings.TrimSpace(name) == "" || len(privateKey) != ed25519.PrivateKeySize {
		return RegistrationProof{}, errors.New("machine registration name and signing key are required")
	}
	keyID, err := privateKeyID(privateKey)
	if err != nil {
		return RegistrationProof{}, err
	}
	message := registrationProofMessage(name, keyID, issuedAt, nonce)
	return RegistrationProof{
		IssuedAt:  issuedAt,
		Nonce:     nonce,
		Signature: base64.RawURLEncoding.EncodeToString(ed25519.Sign(privateKey, message)),
	}, nil
}

func registrationProofMessage(name, keyID string, issuedAt time.Time, nonce string) []byte {
	return []byte(strings.Join([]string{
		registrationProofDomain,
		name,
		keyID,
		issuedAt.Format(time.RFC3339Nano),
		nonce,
	}, registrationProofLineSeparator))
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
