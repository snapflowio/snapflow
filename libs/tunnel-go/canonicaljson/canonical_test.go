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
	"encoding/json"
	"testing"
)

const crossLanguageVectorInput = `{"z":"a&b<c>d e f","é":"ünïcødé 🚀","a":{"nested":[1,-2,9007199254740991,{"y":null,"x":true}],"empty":{}},"path":"/a&b","quote":"\"\/\b\f\n\r\t\u0001\u001f\u007f","￿":"bmp-last","😀":"astral"}`

const crossLanguageVectorCanonical = `{"a":{"empty":{},"nested":[1,-2,9007199254740991,{"x":true,"y":null}]},` +
	`"path":"/a&b","quote":"\"/\b\f\n\r\t\u0001\u001f` + "\u007f" + `",` +
	`"z":"a&b<c>d` + " " + `e` + " " + `f",` +
	`"` + "é" + `":"` + "ünïcødé \U0001F680" + `",` +
	`"` + "\U0001F600" + `":"astral",` +
	`"` + "￿" + `":"bmp-last"}`

const crossLanguageVectorDigest = "6bcd7c00dcb4eae7a324cd0463fdd9b8a5ce3c4ab89c0545cc807965948fc8d8"

func TestMarshalMatchesTypeScriptCanonicalJSON(t *testing.T) {
	t.Parallel()
	var input any
	if err := json.Unmarshal([]byte(crossLanguageVectorInput), &input); err != nil {
		t.Fatalf("decode vector input: %v", err)
	}
	encoded, err := Marshal(input)
	if err != nil {
		t.Fatalf("marshal vector: %v", err)
	}
	if string(encoded) != crossLanguageVectorCanonical {
		t.Fatalf("canonical JSON = %q, want %q", encoded, crossLanguageVectorCanonical)
	}
	digest, err := SHA256(input)
	if err != nil {
		t.Fatalf("digest vector: %v", err)
	}
	if digest != crossLanguageVectorDigest {
		t.Fatalf("digest = %s, want %s", digest, crossLanguageVectorDigest)
	}
}

func TestMarshalEncodesStructsWithoutHTMLEscaping(t *testing.T) {
	t.Parallel()
	type document struct {
		Path    string   `json:"path"`
		Origins []string `json:"origins"`
		Port    int32    `json:"port"`
	}
	encoded, err := Marshal(document{
		Path:    "/a&b<c>",
		Origins: []string{"https://example.com/?a=1&b=2"},
		Port:    8080,
	})
	if err != nil {
		t.Fatalf("marshal struct: %v", err)
	}
	const expected = `{"origins":["https://example.com/?a=1&b=2"],"path":"/a&b<c>","port":8080}`
	if string(encoded) != expected {
		t.Fatalf("canonical JSON = %s, want %s", encoded, expected)
	}
}

func TestMarshalRejectsValuesTypeScriptCannotReproduce(t *testing.T) {
	t.Parallel()
	for name, value := range map[string]any{
		"fraction":          1.5,
		"unsafe integer":    int64(maximumSafeInteger + 1),
		"negative unsafe":   int64(-maximumSafeInteger - 1),
		"unsupported value": func() {},
	} {
		if _, err := Marshal(value); err == nil {
			t.Fatalf("%s was accepted", name)
		}
	}
}
