// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sshgateway

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"golang.org/x/crypto/ssh"
)

const (
	minimumNetworkPort   = 1
	maximumNetworkPort   = 65_535
	privateKeyPEMType    = "PRIVATE KEY"
	hostKeyDirectoryMode = 0o700
	hostKeyFileMode      = 0o600
)

type Config struct {
	Port        int
	HostKeyFile string
}

type Dependencies struct {
	Runtime sandboxruntime.GuestServices
	Access  AccessControl
}

func (cfg Config) load() (ssh.Signer, error) {
	if cfg.Port < minimumNetworkPort || cfg.Port > maximumNetworkPort {
		return nil, fmt.Errorf("machine SSH gateway port must be between %d and %d", minimumNetworkPort, maximumNetworkPort)
	}
	if !filepath.IsAbs(cfg.HostKeyFile) {
		return nil, errors.New("machine SSH host key path must be absolute")
	}
	hostKey, err := loadOrCreateHostKey(cfg.HostKeyFile)
	if err != nil {
		return nil, err
	}
	return hostKey, nil
}

func loadOrCreateHostKey(path string) (ssh.Signer, error) {
	payload, err := readRegularFile(path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("read SSH host key: %w", err)
		}
		if err := generateHostKey(path); err != nil && !errors.Is(err, os.ErrExist) {
			return nil, fmt.Errorf("generate SSH host key: %w", err)
		}
		payload, err = readRegularFile(path)
		if err != nil {
			return nil, fmt.Errorf("read generated SSH host key: %w", err)
		}
	}
	signer, err := ssh.ParsePrivateKey(payload)
	if err != nil {
		return nil, fmt.Errorf("parse SSH host key: %w", err)
	}
	return signer, nil
}

func readRegularFile(path string) ([]byte, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
		return nil, fmt.Errorf("path must be a regular non-symlink file: %s", path)
	}
	return os.ReadFile(path)
}

func generateHostKey(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), hostKeyDirectoryMode); err != nil {
		return fmt.Errorf("create SSH host key directory: %w", err)
	}
	payload, err := encodeHostKey()
	if err != nil {
		return err
	}
	return writeNewHostKey(path, payload)
}

func encodeHostKey() ([]byte, error) {
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate Ed25519 host key: %w", err)
	}
	encodedKey, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("encode Ed25519 host key: %w", err)
	}
	var payload bytes.Buffer
	if err := pem.Encode(&payload, &pem.Block{Type: privateKeyPEMType, Bytes: encodedKey}); err != nil {
		return nil, fmt.Errorf("encode SSH host key PEM: %w", err)
	}
	return payload.Bytes(), nil
}

func writeNewHostKey(path string, payload []byte) (resultErr error) {
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, hostKeyFileMode)
	if err != nil {
		return err
	}
	published := false
	defer func() {
		if published {
			return
		}
		if removeErr := os.Remove(path); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove incomplete SSH host key: %w", removeErr))
		}
	}()
	if err := writeAndSync(file, payload); err != nil {
		return errors.Join(err, file.Close())
	}
	if closeErr := file.Close(); closeErr != nil {
		return fmt.Errorf("close SSH host key: %w", closeErr)
	}
	published = true
	return nil
}

func writeAndSync(file *os.File, payload []byte) error {
	written, err := file.Write(payload)
	if err == nil && written != len(payload) {
		err = io.ErrShortWrite
	}
	if err != nil {
		return fmt.Errorf("write SSH host key: %w", err)
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync SSH host key: %w", err)
	}
	return nil
}
