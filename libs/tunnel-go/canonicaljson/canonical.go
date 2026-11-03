// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package canonicaljson

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strconv"
	"unicode/utf16"
)

const maximumSafeInteger = 1<<53 - 1

const hexDigits = "0123456789abcdef"

func Marshal(value any) ([]byte, error) {
	var encoded bytes.Buffer
	encoder := json.NewEncoder(&encoded)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, fmt.Errorf("marshal canonical JSON input: %w", err)
	}
	decoder := json.NewDecoder(&encoded)
	decoder.UseNumber()
	var decoded any
	if err := decoder.Decode(&decoded); err != nil {
		return nil, fmt.Errorf("decode canonical JSON input: %w", err)
	}
	var result bytes.Buffer
	if err := writeValue(&result, decoded); err != nil {
		return nil, err
	}
	return result.Bytes(), nil
}

func SHA256(value any) (string, error) {
	payload, err := Marshal(value)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(payload)
	return hex.EncodeToString(digest[:]), nil
}

func writeValue(destination *bytes.Buffer, value any) error {
	switch typed := value.(type) {
	case nil:
		destination.WriteString("null")
	case bool:
		destination.WriteString(strconv.FormatBool(typed))
	case string:
		writeString(destination, typed)
	case json.Number:
		return writeInteger(destination, typed)
	case []any:
		return writeArray(destination, typed)
	case map[string]any:
		return writeObject(destination, typed)
	default:
		return fmt.Errorf("unsupported canonical JSON value %T", value)
	}
	return nil
}

func writeArray(destination *bytes.Buffer, elements []any) error {
	destination.WriteByte('[')
	for index, element := range elements {
		if index != 0 {
			destination.WriteByte(',')
		}
		if err := writeValue(destination, element); err != nil {
			return err
		}
	}
	destination.WriteByte(']')
	return nil
}

func writeObject(destination *bytes.Buffer, members map[string]any) error {
	keys := slices.SortedFunc(maps.Keys(members), compareUTF16)
	destination.WriteByte('{')
	for index, key := range keys {
		if index != 0 {
			destination.WriteByte(',')
		}
		writeString(destination, key)
		destination.WriteByte(':')
		if err := writeValue(destination, members[key]); err != nil {
			return err
		}
	}
	destination.WriteByte('}')
	return nil
}

func writeInteger(destination *bytes.Buffer, value json.Number) error {
	parsed, err := value.Int64()
	if err != nil {
		return fmt.Errorf("canonical JSON contains a non-integer number %q", value)
	}
	if parsed > maximumSafeInteger || parsed < -maximumSafeInteger {
		return fmt.Errorf("canonical JSON integer %d exceeds the JavaScript safe range", parsed)
	}
	destination.WriteString(strconv.FormatInt(parsed, 10))
	return nil
}

func writeString(destination *bytes.Buffer, value string) {
	destination.WriteByte('"')
	for _, character := range value {
		switch character {
		case '"':
			destination.WriteString(`\"`)
		case '\\':
			destination.WriteString(`\\`)
		case '\b':
			destination.WriteString(`\b`)
		case '\f':
			destination.WriteString(`\f`)
		case '\n':
			destination.WriteString(`\n`)
		case '\r':
			destination.WriteString(`\r`)
		case '\t':
			destination.WriteString(`\t`)
		default:
			if character < ' ' {
				destination.WriteString(`\u00`)
				destination.WriteByte(hexDigits[character>>4])
				destination.WriteByte(hexDigits[character&0xF])
				continue
			}
			destination.WriteRune(character)
		}
	}
	destination.WriteByte('"')
}

func compareUTF16(left, right string) int {
	return slices.Compare(utf16.Encode([]rune(left)), utf16.Encode([]rune(right)))
}
