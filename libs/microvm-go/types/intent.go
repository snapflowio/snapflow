// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package types

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
)

const IntentDigestPrefix = "sha256:"

func CreateRequestIntentDigest(request CreateRequest) (string, error) {
	request.Identity = RuntimeArtifactIdentity{}
	encoded, err := json.Marshal(PersistentCreateRequest(request))
	if err != nil {
		return "", fmt.Errorf("encode sandbox intent: %w", err)
	}
	sum := sha256.Sum256(encoded)
	return IntentDigestPrefix + hex.EncodeToString(sum[:]), nil
}
