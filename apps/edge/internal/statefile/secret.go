// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package statefile

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/snapflowio/common-go/pkg/atomicfile"
)

const (
	minimumSecretBytes     = 32
	secretTemporaryPattern = ".secret-*.tmp"
	currentDirectoryName   = "."
)

func LoadOrCreateSecret(
	directory string,
	filename string,
	size int,
) ([]byte, error) {
	if !filepath.IsAbs(directory) || filepath.Base(filename) != filename ||
		filename == currentDirectoryName || size < minimumSecretBytes {
		return nil, errors.New("secret state path or size is invalid")
	}
	if err := EnsureDirectory(directory); err != nil {
		return nil, err
	}
	path := filepath.Join(directory, filename)
	secret, err := readSecret(path, size)
	if err == nil {
		return secret, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	secret = make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, secret); err != nil {
		return nil, fmt.Errorf("generate state secret: %w", err)
	}
	if err := installSecret(directory, path, secret); err != nil {
		clear(secret)
		if errors.Is(err, os.ErrExist) {
			return readSecret(path, size)
		}
		return nil, err
	}
	return secret, nil
}

func readSecret(path string, size int) ([]byte, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return nil, fmt.Errorf("inspect state secret: %w", err)
	}
	if !info.Mode().IsRegular() ||
		info.Mode().Perm()&nonOwnerPermissionBitmask != 0 {
		return nil, errors.New("state secret must be a regular file with mode 0600 or stricter")
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read state secret: %w", err)
	}
	if len(payload) != size {
		clear(payload)
		return nil, fmt.Errorf(
			"state secret has %d bytes, expected %d",
			len(payload),
			size,
		)
	}
	return payload, nil
}

func installSecret(directory, path string, secret []byte) (resultErr error) {
	file, err := os.CreateTemp(directory, secretTemporaryPattern)
	if err != nil {
		return fmt.Errorf("create state secret temporary file: %w", err)
	}
	temporaryPath := file.Name()
	defer func() {
		removeErr := os.Remove(temporaryPath)
		if removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			resultErr = errors.Join(
				resultErr,
				fmt.Errorf("remove state secret temporary file: %w", removeErr),
			)
		}
	}()
	if err := writePrivateFile(file, secret); err != nil {
		return err
	}
	if err := os.Link(temporaryPath, path); err != nil {
		if errors.Is(err, os.ErrExist) {
			return os.ErrExist
		}
		return fmt.Errorf("install state secret: %w", err)
	}
	return atomicfile.SyncDirectory(directory)
}

func writePrivateFile(file *os.File, payload []byte) error {
	if err := file.Chmod(privateFileMode); err != nil {
		return errors.Join(fmt.Errorf("secure state temporary file: %w", err), file.Close())
	}
	if _, err := file.Write(payload); err != nil {
		return errors.Join(fmt.Errorf("write state file: %w", err), file.Close())
	}
	if err := file.Sync(); err != nil {
		return errors.Join(fmt.Errorf("sync state file: %w", err), file.Close())
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close state file: %w", err)
	}
	return nil
}
