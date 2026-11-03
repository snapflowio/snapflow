// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"strings"
	"testing"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/common-go/pkg/logging"
)

const (
	testAPIURL           = "https://api.snapflow.test/api"
	testEdgeID           = "0d8c3c0e-4f5e-4a37-9a51-0d5bb5f4e8a1"
	testEnrollmentSecret = "hosted-enrollment-secret"
	testStaleVariable    = environmentVariablePrefix + "STATE_DIR"
	testStaleValue       = "/var/lib/stale"
)

func hostedTestConfig(t *testing.T) Config {
	t.Helper()
	config, err := profileConfig(deployment.Production)
	if err != nil {
		t.Fatalf("production profile: %v", err)
	}
	config.Control.APIURL = testAPIURL
	config.EdgeID = testEdgeID
	config.Control.EnrollmentSecret = testEnrollmentSecret
	return config
}

func setHostedIdentity(t *testing.T) {
	t.Helper()
	t.Setenv(APIURLEnvironmentVariable, testAPIURL)
	t.Setenv(EdgeIDEnvironmentVariable, testEdgeID)
	t.Setenv(EnrollmentSecretEnvironmentVariable, testEnrollmentSecret)
}

func TestValidateAcceptsEveryProfile(t *testing.T) {
	t.Parallel()
	if err := hostedTestConfig(t).Validate(); err != nil {
		t.Fatalf("valid hosted configuration rejected: %v", err)
	}
	development, err := profileConfig(deployment.Development)
	if err != nil {
		t.Fatalf("development profile: %v", err)
	}
	if err := development.Validate(); err != nil {
		t.Fatalf("development profile rejected: %v", err)
	}
}

func TestValidateNamesTheInvalidSetting(t *testing.T) {
	t.Parallel()
	for name, test := range map[string]struct {
		mutate  func(*Config)
		setting string
	}{
		"API URL without base path": {
			mutate:  func(config *Config) { config.Control.APIURL = "https://api.snapflow.test" },
			setting: APIURLEnvironmentVariable,
		},
		"edge ID": {
			mutate:  func(config *Config) { config.EdgeID = "edge" },
			setting: EdgeIDEnvironmentVariable,
		},
		"public metrics listener": {
			mutate:  func(config *Config) { config.Telemetry.ListenAddress = "0.0.0.0:9090" },
			setting: metricsListenSetting,
		},
		"zero port": {
			mutate:  func(config *Config) { config.HTTP.HTTPAddress = ":0" },
			setting: httpListenSetting,
		},
		"development API URL": {
			mutate:  func(config *Config) { config.Control.APIURL = DevelopmentAPIURL },
			setting: APIURLEnvironmentVariable,
		},
		"development edge ID": {
			mutate:  func(config *Config) { config.EdgeID = DevelopmentEdgeID },
			setting: EdgeIDEnvironmentVariable,
		},
	} {
		config := hostedTestConfig(t)
		test.mutate(&config)
		err := config.Validate()
		if err == nil || !strings.Contains(err.Error(), test.setting) {
			t.Fatalf("%s: error = %v, want it to name %s", name, err, test.setting)
		}
	}
}

func TestValidateRejectsRelativeStatePaths(t *testing.T) {
	t.Parallel()
	config := hostedTestConfig(t)
	config.StateDir = "state"
	if err := config.Validate(); err == nil {
		t.Fatal("relative state directory was accepted")
	}
}

func TestNoProfileCarriesASecret(t *testing.T) {
	t.Parallel()
	for _, profile := range []deployment.Profile{deployment.Development, deployment.Production} {
		config, err := profileConfig(profile)
		if err != nil {
			t.Fatalf("%s profile: %v", profile, err)
		}
		if config.Control.EnrollmentSecret != "" {
			t.Fatalf("%s profile carries an enrollment secret", profile)
		}
	}
}

func TestLoadDevelopmentReadsTheSecretFromTheEnvironment(t *testing.T) {
	t.Setenv(EnrollmentSecretEnvironmentVariable, testEnrollmentSecret)
	loaded, err := LoadConfig(deployment.Development)
	if err != nil {
		t.Fatalf("LoadConfig(development) error = %v", err)
	}
	if loaded.EdgeID != DevelopmentEdgeID || loaded.Control.APIURL != DevelopmentAPIURL ||
		loaded.Control.EnrollmentSecret != testEnrollmentSecret {
		t.Fatalf("development identity = %q %q, want the development defaults and the environment secret", loaded.Control.APIURL, loaded.EdgeID)
	}
}

func TestLoadHostedRequiresTheIdentity(t *testing.T) {
	if _, err := LoadConfig(deployment.Production); err == nil {
		t.Fatal("production loaded without an Edge identity")
	}
	setHostedIdentity(t)
	loaded, err := LoadConfig(deployment.Production)
	if err != nil {
		t.Fatalf("LoadConfig(production) error = %v", err)
	}
	if loaded.Control.APIURL != testAPIURL || loaded.EdgeID != testEdgeID || loaded.StateDir != hostedStateDir {
		t.Fatalf("production configuration = %+v", loaded)
	}
}

func TestLoadRejectsRemovedVariables(t *testing.T) {
	setHostedIdentity(t)
	t.Setenv(testStaleVariable, testStaleValue)
	if _, err := LoadConfig(deployment.Production); err == nil {
		t.Fatalf("LoadConfig accepted the removed variable %s", testStaleVariable)
	}
}

func TestLoadTreatsEmptyVariablesAsUnset(t *testing.T) {
	for _, key := range environmentVariables() {
		t.Setenv(key, "")
	}
	t.Setenv(logging.LevelEnvironmentVariable, "")
	loaded, err := LoadConfig(deployment.Development)
	if err != nil {
		t.Fatalf("LoadConfig(development) with empty variables error = %v", err)
	}
	if loaded.Control.APIURL != DevelopmentAPIURL || loaded.EdgeID != DevelopmentEdgeID ||
		loaded.LogLevel != developmentLogLevel || loaded.Control.EnrollmentSecret != "" {
		t.Fatalf("empty variables overrode the development profile: %+v", loaded)
	}
}
