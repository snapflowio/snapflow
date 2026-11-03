// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package state

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/snapflowio/common-go/pkg/atomicfile"
)

const (
	systemdVaultBackend  = "systemd-credential"
	credentialDir        = "credentials"
	credentialSuffix     = ".cred"
	credentialNamePrefix = "snapflow.machine."
	credentialMode       = 0o600
	maximumSecretBytes   = 1 << 20
)

type systemdVault struct {
	directory string
	binary    string
}

func NewPlatformVault(stateDirectory string) (Vault, error) {
	binary, err := exec.LookPath("systemd-creds")
	if err != nil {
		return nil, fmt.Errorf("systemd-creds is required for machine credential storage: %w", err)
	}
	directory := filepath.Join(stateDirectory, credentialDir)
	if err := os.MkdirAll(directory, directoryMode); err != nil {
		return nil, fmt.Errorf("create machine credential directory: %w", err)
	}
	if err := os.Chmod(directory, directoryMode); err != nil {
		return nil, fmt.Errorf("protect machine credential directory: %w", err)
	}
	return &systemdVault{directory: directory, binary: binary}, nil
}

func (*systemdVault) Backend() string { return systemdVaultBackend }

func (vault *systemdVault) Put(ctx context.Context, reference string, payload []byte) (resultErr error) {
	if err := validateKeyReference(reference); err != nil {
		return err
	}
	if len(payload) > maximumSecretBytes {
		return fmt.Errorf("machine credential exceeds %d bytes", maximumSecretBytes)
	}
	ciphertext, err := vault.run(ctx, "encrypt", reference, payload, "-")
	if err != nil {
		return err
	}
	path := vault.path(reference)
	temporary, err := os.CreateTemp(vault.directory, ".credential-*")
	if err != nil {
		return fmt.Errorf("create temporary machine credential: %w", err)
	}
	temporaryPath := temporary.Name()
	published := false
	defer func() {
		if !published {
			if removeErr := os.Remove(temporaryPath); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
				resultErr = errors.Join(resultErr, fmt.Errorf("remove unpublished machine credential: %w", removeErr))
			}
		}
	}()
	if err := writeCredential(temporary, ciphertext); err != nil {
		return errors.Join(err, temporary.Close())
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close temporary machine credential: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish machine credential: %w", err)
	}
	if err := atomicfile.SyncDirectory(vault.directory); err != nil {
		return err
	}
	published = true
	return nil
}

func writeCredential(file *os.File, ciphertext []byte) error {
	if err := file.Chmod(credentialMode); err != nil {
		return fmt.Errorf("protect temporary machine credential: %w", err)
	}
	if _, err := file.Write(ciphertext); err != nil {
		return fmt.Errorf("write temporary machine credential: %w", err)
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync temporary machine credential: %w", err)
	}
	return nil
}

func (vault *systemdVault) Get(ctx context.Context, reference string) ([]byte, error) {
	if err := validateKeyReference(reference); err != nil {
		return nil, err
	}
	path := vault.path(reference)
	info, err := os.Lstat(path)
	if err != nil {
		return nil, fmt.Errorf("inspect machine credential: %w", err)
	}
	if !info.Mode().IsRegular() || info.Mode().Perm()&0o077 != 0 {
		return nil, fmt.Errorf("machine credential has unsafe type or permissions")
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read machine credential: %w", err)
	}
	if len(payload) > maximumSecretBytes {
		return nil, fmt.Errorf("machine credential exceeds %d bytes", maximumSecretBytes)
	}
	return vault.run(ctx, "decrypt", reference, payload, path)
}

func (vault *systemdVault) Delete(ctx context.Context, reference string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := validateKeyReference(reference); err != nil {
		return err
	}
	if err := os.Remove(vault.path(reference)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("delete machine credential: %w", err)
	}
	return atomicfile.SyncDirectory(vault.directory)
}

func (vault *systemdVault) path(reference string) string {
	return filepath.Join(vault.directory, reference+credentialSuffix)
}

func (vault *systemdVault) run(ctx context.Context, operation, reference string, input []byte, source string) ([]byte, error) {
	arguments := vaultArguments(operation, reference, source)
	command := exec.CommandContext(ctx, vault.binary, arguments...)
	command.Stdin = bytes.NewReader(input)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr
	if err := command.Run(); err != nil {
		detail := strings.TrimSpace(stderr.String())
		if detail != "" {
			return nil, fmt.Errorf("systemd-creds %s failed: %s: %w", operation, detail, err)
		}
		return nil, fmt.Errorf("systemd-creds %s failed: %w", operation, err)
	}
	if stdout.Len() > maximumSecretBytes {
		return nil, fmt.Errorf("systemd-creds output exceeds %d bytes", maximumSecretBytes)
	}
	return stdout.Bytes(), nil
}

func vaultArguments(operation, reference, source string) []string {
	arguments := []string{
		operation,
		"--name=" + credentialNamePrefix + reference,
	}
	if operation == "encrypt" {
		return append(arguments, "-", "-")
	}
	return append(arguments, source, "-")
}
