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

package exitinfo

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
)

const (
	Prefix              = "SNAPFLOW-EXIT "
	DefaultTailSize     = int64(8192)
	MaximumMessageBytes = 1024
)

type Record struct {
	Code         int
	GenerationID string
	Message      string
}

func Format(record Record) string {
	record.Message = truncateUTF8(record.Message, MaximumMessageBytes)
	return fmt.Sprintf("%scode=%d generation=%q message=%q", Prefix, record.Code, record.GenerationID, record.Message)
}

func ParseLine(line string) (Record, bool) {
	line = strings.TrimSpace(line)
	_, value, found := strings.Cut(line, Prefix)
	if !found {
		return Record{}, false
	}
	if !strings.HasPrefix(value, "code=") {
		return Record{}, false
	}
	value = strings.TrimPrefix(value, "code=")
	codeValue, remainder, found := strings.Cut(value, " ")
	if !found {
		code, err := strconv.Atoi(value)
		return Record{Code: code}, err == nil
	}
	code, err := strconv.Atoi(codeValue)
	if err != nil {
		return Record{}, false
	}
	record := Record{Code: code}
	generationValue, remainder, found := strings.Cut(remainder, " ")
	if !found || !strings.HasPrefix(generationValue, "generation=") {
		return Record{}, false
	}
	generation, err := strconv.Unquote(strings.TrimPrefix(generationValue, "generation="))
	if err != nil || generation == "" {
		return Record{}, false
	}
	record.GenerationID = generation
	if messageValue, ok := strings.CutPrefix(remainder, "message="); ok {
		if message, unquoteErr := strconv.Unquote(messageValue); unquoteErr == nil {
			record.Message = truncateUTF8(message, MaximumMessageBytes)
		} else {
			record.Message = truncateUTF8(
				strings.Trim(messageValue, "\""),
				MaximumMessageBytes,
			)
		}
	}
	return record, true
}

func truncateUTF8(value string, maximumBytes int) string {
	if maximumBytes <= 0 {
		return ""
	}
	if len(value) <= maximumBytes {
		return value
	}
	var result strings.Builder
	result.Grow(maximumBytes)
	for _, character := range value {
		encoded := string(character)
		if result.Len()+len(encoded) > maximumBytes {
			break
		}
		result.WriteString(encoded)
	}
	return result.String()
}

func ReadLatest(path string, tailSize int64, generationID string) (Record, bool, error) {
	if tailSize <= 0 {
		tailSize = DefaultTailSize
	}
	data, err := ReadTail(path, tailSize)
	if err != nil {
		return Record{}, false, err
	}
	lines := strings.Split(string(data), "\n")
	for index := len(lines) - 1; index >= 0; index-- {
		if record, ok := ParseLine(lines[index]); ok && (generationID == "" || record.GenerationID == generationID) {
			return record, true, nil
		}
	}
	return Record{}, false, nil
}

func ReadTail(path string, size int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	offset := max(info.Size()-size, 0)
	if offset > 0 {
		if _, err := file.Seek(offset, io.SeekStart); err != nil {
			return nil, err
		}
	}
	return io.ReadAll(file)
}
