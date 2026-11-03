// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package config

import (
	"reflect"
	"slices"
	"strings"
	"testing"
)

func secretFieldMarkers() []string {
	return []string{"Secret", "Password", "Token", "Credential"}
}

func TestOnlyDevelopmentTrustsLocalObjectStorage(t *testing.T) {
	development, err := RuntimeProfile(Development)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(development.TrustedObjectStorageOrigins, []string{developmentObjectStorageOrigin}) {
		t.Fatalf("development object storage origins = %v", development.TrustedObjectStorageOrigins)
	}
	production, err := RuntimeProfile(Production)
	if err != nil {
		t.Fatal(err)
	}
	if len(production.TrustedObjectStorageOrigins) != 0 {
		t.Errorf("production trusts object storage origins %v; HTTPS must be mandatory", production.TrustedObjectStorageOrigins)
	}
}

func TestDefaultAPIURLsAreValid(t *testing.T) {
	for _, name := range []ProfileName{Development, Production} {
		selected, err := RuntimeProfile(name)
		if err != nil {
			t.Fatal(err)
		}
		if err := selected.ValidateAPIURL(selected.APIURL); err != nil {
			t.Errorf("%s default API URL %q rejected: %v", name, selected.APIURL, err)
		}
	}
}

func TestDevelopmentStateLivesInTheWorkspace(t *testing.T) {
	configuration, err := Load(Development)
	if err != nil {
		t.Fatal(err)
	}
	if configuration.Machine.StateDirectory != developmentMachineState {
		t.Fatalf("development state directory = %q, want %q", configuration.Machine.StateDirectory, developmentMachineState)
	}
}

func TestDevelopmentProfileCarriesNoSecret(t *testing.T) {
	configuration, err := Load(Development)
	if err != nil {
		t.Fatal(err)
	}
	assertNoSecretFields(t, reflect.TypeOf(*configuration), "Config")
}

func assertNoSecretFields(t *testing.T, structType reflect.Type, path string) {
	t.Helper()
	for index := range structType.NumField() {
		field := structType.Field(index)
		fieldPath := path + "." + field.Name
		for _, marker := range secretFieldMarkers() {
			if strings.Contains(field.Name, marker) {
				t.Errorf("%s may hold a secret; secrets must come from the environment or Vault", fieldPath)
			}
		}
		fieldType := field.Type
		if fieldType.Kind() == reflect.Pointer {
			fieldType = fieldType.Elem()
		}
		if fieldType.Kind() == reflect.Struct {
			assertNoSecretFields(t, fieldType, fieldPath)
		}
	}
}
