// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"errors"
	"fmt"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const InvalidRequestErrorCode = "INVALID_REQUEST_BODY"

var errPayloadRequired = errors.New("payload is required")

type invalidPayloadError struct {
	message string
	err     error
}

func (e *invalidPayloadError) Error() string {
	return fmt.Sprintf("invalid %s: %v", e.message, e.err)
}

func (e *invalidPayloadError) Unwrap() error {
	return e.err
}

func (e *invalidPayloadError) ErrorCode() string {
	return InvalidRequestErrorCode
}

func Decode(payload string, message proto.Message) error {
	name := string(message.ProtoReflect().Descriptor().Name())
	if payload == "" {
		return &invalidPayloadError{message: name, err: errPayloadRequired}
	}
	if err := protojson.Unmarshal([]byte(payload), message); err != nil {
		return &invalidPayloadError{message: name, err: err}
	}
	if err := validate(message); err != nil {
		return &invalidPayloadError{message: name, err: err}
	}
	return nil
}
