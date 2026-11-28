// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"encoding/json"
	"fmt"

	"github.com/snapflowio/tunnel-go/canonicaljson"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

func ProtoJSONDigest(message proto.Message) (string, error) {
	encoded, err := protojson.Marshal(message)
	if err != nil {
		return "", fmt.Errorf("encode %s as proto3 JSON: %w", message.ProtoReflect().Descriptor().Name(), err)
	}
	return canonicaljson.SHA256(json.RawMessage(encoded))
}

func matchingDigest(field, digest string, message proto.Message) error {
	if err := sha256HexField(field, digest); err != nil {
		return err
	}
	calculated, err := ProtoJSONDigest(message)
	if err != nil {
		return err
	}
	if calculated != digest {
		return fmt.Errorf("%s %s does not match the content digest %s", field, digest, calculated)
	}
	return nil
}
