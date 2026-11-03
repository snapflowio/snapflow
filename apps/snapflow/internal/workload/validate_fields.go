// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/url"
	"slices"
	"strings"

	"github.com/google/uuid"
)

const (
	sha256HexLength = sha256.Size * 2
	dataKeyBytes    = 32
)

func urlSchemes() []string {
	return []string{"http", "https"}
}

func requiredField(field, value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}

func uuidField(field, value string) error {
	if err := uuid.Validate(value); err != nil {
		return fmt.Errorf("%s must be a UUID: %w", field, err)
	}
	return nil
}

func optionalUUIDField(field string, value *string) error {
	if value == nil {
		return nil
	}
	return uuidField(field, *value)
}

func urlField(field, value string) error {
	parsed, err := url.ParseRequestURI(value)
	if err != nil {
		return fmt.Errorf("%s must be a URL: %w", field, err)
	}
	if !slices.Contains(urlSchemes(), parsed.Scheme) || parsed.Host == "" {
		return fmt.Errorf("%s must be an absolute http or https URL", field)
	}
	return nil
}

// dataKeyField requires a base64 AES-256 key, the per-backup data key.
func dataKeyField(field, value string) error {
	if err := requiredField(field, value); err != nil {
		return err
	}
	key, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return fmt.Errorf("%s must be base64: %w", field, err)
	}
	if len(key) != dataKeyBytes {
		return fmt.Errorf("%s must encode %d bytes", field, dataKeyBytes)
	}
	return nil
}

func sha256HexField(field, value string) error {
	if len(value) != sha256HexLength {
		return fmt.Errorf("%s must be %d hexadecimal characters", field, sha256HexLength)
	}
	if _, err := hex.DecodeString(value); err != nil {
		return fmt.Errorf("%s must be hexadecimal: %w", field, err)
	}
	return nil
}

func oneOfField(field, value string, allowed []string) error {
	if !slices.Contains(allowed, value) {
		return fmt.Errorf("%s must be one of %v, got %q", field, allowed, value)
	}
	return nil
}

func eachOneOfField(field string, values, allowed []string) error {
	for index, value := range values {
		if err := oneOfField(fmt.Sprintf("%s[%d]", field, index), value, allowed); err != nil {
			return err
		}
	}
	return nil
}

type integer interface {
	~int32 | ~int64 | ~uint32 | ~uint64
}

func minimumField[T integer](field string, value, minimum T) error {
	if value < minimum {
		return fmt.Errorf("%s must be at least %d, got %d", field, minimum, value)
	}
	return nil
}
