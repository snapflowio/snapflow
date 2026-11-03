// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const (
	privateKeyExtension     = ".pem"
	privateKeyPEMType       = "PRIVATE KEY"
	privateKeyDirectoryMode = 0o700
	privateKeyFileMode      = 0o600
)

func generatePrivateKey(path string) (ed25519.PrivateKey, error) {
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate Ed25519 key: %w", err)
	}
	encoded, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("encode Ed25519 private key: %w", err)
	}
	block := pem.EncodeToMemory(&pem.Block{Type: privateKeyPEMType, Bytes: encoded})
	if len(block) == 0 {
		return nil, errors.New("encode private key PEM")
	}
	if err := writeNewPrivateFile(path, block); err != nil {
		return nil, err
	}
	return privateKey, nil
}

func loadPrivateKey(path string) (ed25519.PrivateKey, error) {
	encoded, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return nil, fmt.Errorf("read signing key: %w", err)
	}
	block, trailing := pem.Decode(encoded)
	if block == nil || block.Type != privateKeyPEMType || len(trailing) != 0 {
		return nil, errors.New("signing key must contain exactly one PKCS#8 private key")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse signing key: %w", err)
	}
	privateKey, ok := parsed.(ed25519.PrivateKey)
	if !ok {
		return nil, errors.New("signing key must be Ed25519")
	}
	return privateKey, nil
}

func writeNewPrivateFile(path string, contents []byte) (resultErr error) {
	if err := os.MkdirAll(filepath.Dir(path), privateKeyDirectoryMode); err != nil {
		return fmt.Errorf("create private key directory: %w", err)
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, privateKeyFileMode)
	if err != nil {
		return fmt.Errorf("create private key %q: %w", path, err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, closeErr)
		}
	}()
	if _, err := file.Write(contents); err != nil {
		return err
	}
	return file.Sync()
}

func privateKeyName(role string, index int) string {
	return fmt.Sprintf("%s-%d%s", role, index, privateKeyExtension)
}
