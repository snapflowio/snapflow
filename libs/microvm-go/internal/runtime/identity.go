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

package runtime

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/internal/state"
)

const internalCredentialBytes = 32

func initializeInstanceIdentity(metadata *state.InstanceMetadata) error {
	if metadata == nil {
		return fmt.Errorf("instance metadata is required")
	}
	controlToken, err := generateInternalCredential()
	if err != nil {
		return fmt.Errorf("generate control credential: %w", err)
	}
	metadata.GenerationID = uuid.NewString()
	metadata.GuestProtocolVersion = 0
	metadata.GuestBuildDigest = ""
	metadata.GuestBootID = ""
	metadata.GuestKeyID = ""
	metadata.GuestObservedAt = nil
	metadata.GuestServiceTokens = make(map[string]string)
	for _, service := range metadata.GuestServices {
		if !service.Credential {
			continue
		}
		token, err := generateInternalCredential()
		if err != nil {
			return fmt.Errorf("generate credential for guest service %q: %w", service.Name, err)
		}
		metadata.GuestServiceTokens[service.Name] = token
	}
	metadata.ControlAuthToken = controlToken
	metadata.RestoreControlAuthToken = ""
	return nil
}

func validateInstanceIdentity(metadata state.InstanceMetadata) error {
	if metadata.GenerationID == "" {
		return fmt.Errorf("instance generation identity is required")
	}
	if metadata.ControlAuthToken == "" {
		return fmt.Errorf("instance control credential is required")
	}
	for _, service := range metadata.GuestServices {
		if service.Credential && metadata.GuestServiceTokens[service.Name] == "" {
			return fmt.Errorf("credential for guest service %q is required", service.Name)
		}
	}
	return nil
}

func rotateInstanceIdentity(metadata *state.InstanceMetadata, restoreToken string) error {
	if metadata == nil {
		return fmt.Errorf("instance metadata is required")
	}
	if restoreToken == "" {
		return fmt.Errorf("snapshot control credential is required")
	}
	if err := initializeInstanceIdentity(metadata); err != nil {
		return err
	}
	metadata.RestoreControlAuthToken = restoreToken
	return nil
}

func generateInternalCredential() (string, error) {
	raw := make([]byte, internalCredentialBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}
