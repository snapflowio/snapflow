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

package protocol

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/google/uuid"
)

const (
	TLSExporterLabel       = "EXPORTER-snapflow-tunnel-client-hello-v1"
	TLSExporterBindingSize = 32
)

func (hello ClientHello) TLSExporterContext() ([]byte, error) {
	if hello.Version != Version || hello.MachineID == uuid.Nil ||
		hello.MachineSessionGeneration == 0 || hello.SessionID == uuid.Nil {
		return nil, errors.New("complete tunnel hello identity is required")
	}
	if err := hello.Binding.Validate(); err != nil {
		return nil, err
	}
	digest, err := hex.DecodeString(hello.Binding.Digest)
	if err != nil {
		return nil, fmt.Errorf("decode binding digest: %w", err)
	}
	context := make([]byte, 0, 2+16+4+16+16+8+len(digest))
	context = binary.BigEndian.AppendUint16(context, uint16(hello.Version))
	context = append(context, hello.MachineID[:]...)
	context = binary.BigEndian.AppendUint32(context, hello.MachineSessionGeneration)
	context = append(context, hello.SessionID[:]...)
	context = append(context, hello.Binding.ID[:]...)
	context = binary.BigEndian.AppendUint64(context, hello.Binding.Revision)
	return append(context, digest...), nil
}

func EncodeTLSExporterBinding(binding []byte) (string, error) {
	if len(binding) != TLSExporterBindingSize {
		return "", fmt.Errorf(
			"TLS exporter binding has %d bytes, expected %d",
			len(binding),
			TLSExporterBindingSize,
		)
	}
	return base64.RawURLEncoding.EncodeToString(binding), nil
}

func DecodeTLSExporterBinding(encoded string) ([]byte, error) {
	binding, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode TLS exporter binding: %w", err)
	}
	if len(binding) != TLSExporterBindingSize {
		return nil, fmt.Errorf(
			"TLS exporter binding has %d bytes, expected %d",
			len(binding),
			TLSExporterBindingSize,
		)
	}
	return binding, nil
}

func ValidateTLSExporterBinding(encoded string) error {
	_, err := DecodeTLSExporterBinding(encoded)
	return err
}
