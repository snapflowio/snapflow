// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/snapflowio/common-go/pkg/atomicfile"
)

const jsonIndent = "  "

func ReadJSONFile(path string, limit int, value any) (bool, error) {
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("read: %w", err)
	}
	if len(payload) > limit {
		return false, fmt.Errorf("the file exceeds its %d byte limit", limit)
	}
	if err := DecodeStrictJSON(payload, value); err != nil {
		return false, err
	}
	return true, nil
}

func DecodeStrictJSON(payload []byte, value any) error {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return fmt.Errorf("decode: %w", err)
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return errors.New("the payload contains trailing JSON")
	}
	return nil
}

func WriteJSONFile(path string, value any, directoryMode, fileMode os.FileMode) error {
	payload, err := json.MarshalIndent(value, "", jsonIndent)
	if err != nil {
		return fmt.Errorf("encode: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), directoryMode); err != nil {
		return fmt.Errorf("create the directory: %w", err)
	}
	if err := atomicfile.WriteFile(path, append(payload, '\n'), fileMode); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}
