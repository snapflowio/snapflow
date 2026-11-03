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

package transport

import (
	"bytes"
	"testing"
)

func TestDeriveServerKeysIsStableAndDomainSeparated(t *testing.T) {
	t.Parallel()
	secret := bytes.Repeat([]byte{0x5a}, 32)
	first, err := DeriveServerKeys(secret)
	if err != nil {
		t.Fatalf("derive server keys: %v", err)
	}
	second, err := DeriveServerKeys(secret)
	if err != nil {
		t.Fatalf("derive server keys again: %v", err)
	}
	if first != second {
		t.Fatal("same persisted secret produced different QUIC server keys")
	}
	if first.StatelessReset == first.TokenGenerator {
		t.Fatal("QUIC server keys were not domain separated")
	}
}

func TestDeriveServerKeysRejectsShortSecret(t *testing.T) {
	t.Parallel()
	if _, err := DeriveServerKeys(make([]byte, 31)); err == nil {
		t.Fatal("short QUIC server secret was accepted")
	}
}
