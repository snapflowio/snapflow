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

package imagecache

import (
	"context"
	"fmt"

	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/snapflowio/microvm-go/types"
)

func Push(ctx context.Context, image Image, imageRef string, registry *types.Registry) error {
	ref, err := parseRegistryReference(imageRef, registry)
	if err != nil {
		return fmt.Errorf("parse push image reference: %w", err)
	}
	options := []remote.Option{remote.WithContext(ctx)}
	if registry != nil && (registry.Username != "" || registry.Password != "") {
		options = append(options, remote.WithAuth(authn.FromConfig(authn.AuthConfig{
			Username: registry.Username,
			Password: registry.Password,
		})))
	} else {
		options = append(options, remote.WithAuthFromKeychain(authn.DefaultKeychain))
	}
	if err := remote.Write(ref, image, options...); err != nil {
		return fmt.Errorf("push image %s: %w", imageRef, err)
	}
	return nil
}
