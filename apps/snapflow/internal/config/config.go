// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package config

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/deployment"
)

const (
	defaultAPIPort            = 8080
	defaultSSHGatewayPort     = 2220
	developmentWorkloadData   = "/var/lib/snapflow-development/workloads"
	developmentMachineState   = deployment.DevelopmentStateRoot + "/machine-state/snapflow/machine"
	developmentSSHHostKeyFile = developmentMachineState + "/ssh_host_ed25519"
	// developmentSnapshotManagerPort is where the local snapshot manager
	// listens; development builders pull and push through it.
	developmentSnapshotManagerPort = 5001
	productionMachineState         = "/var/lib/snapflow/machine"
	productionSSHHostKeyFile       = "/var/lib/snapflow/machine/ssh_host_ed25519"

	// DevelopmentMachineName is the name the local machine enrolls under in the development stack.
	DevelopmentMachineName = "local-machine"
	// DevelopmentEnrollmentSecretEnvironment carries the enrollment secret shared with the local API.
	DevelopmentEnrollmentSecretEnvironment = "SNAPFLOW_DEVELOPMENT_MACHINE_ENROLLMENT_SECRET"
	minimumNetworkPort                     = 1
	maximumNetworkPort                     = 65_535

	defaultJobPollLimit                 = 10
	defaultMetricsWindowSize            = 60
	defaultMetricsSampleInterval        = 5 * time.Second
	defaultHealthInterval               = 30 * time.Second
	defaultHealthTimeout                = 10 * time.Second
	defaultUsageReportInterval          = 30 * time.Second
	defaultUsageParallelism             = 8
	defaultPreparationTimeout           = 15 * time.Minute
	defaultBuildParallelism             = 4
	defaultCacheMaximumEntries          = 64
	defaultCacheMaximumBytes            = 128 << 30
	defaultSnapshotHighThresholdPercent = 85
	defaultSnapshotLowThresholdPercent  = 80
	defaultSnapshotGracePeriod          = 5 * time.Minute
)

type Config struct {
	Profile Profile
	Log     LogConfig
	API     APIConfig
	Jobs    JobsConfig
	Metrics MetricsConfig
	Health  HealthConfig
	Usage   UsageConfig
	Machine MachineConfig
	Runtime RuntimeConfig
	SSH     SSHConfig
}

type LogConfig struct {
	Level string
}

type APIConfig struct {
	Port int
}

type JobsConfig struct {
	PollLimit int
}

type MetricsConfig struct {
	WindowSize                 int
	CPUUsageInterval           time.Duration
	AllocatedResourcesInterval time.Duration
}

type HealthConfig struct {
	Interval time.Duration
	Timeout  time.Duration
}

type UsageConfig struct {
	ReportInterval time.Duration
	Parallelism    int
}

type MachineConfig struct {
	StateDirectory string
}

type RuntimeConfig struct {
	DataDirectory         string
	ReleaseRoot           string
	ManagementRuntimeRoot string
	// HostServicePorts are host TCP ports guests reach at their gateway.
	// Only development exposes one, for the local snapshot manager.
	HostServicePorts   []uint16
	PreparationTimeout time.Duration
	OfferedVCPUs       int64
	OfferedMemoryGiB   int64
	OfferedDiskGiB     int64
	Build              RuntimeBuildConfig
	Cache              RuntimeCacheConfig
	Snapshots          SnapshotConfig
}

type RuntimeBuildConfig struct {
	Parallelism int
}

type RuntimeCacheConfig struct {
	MaximumEntries int
	MaximumBytes   int64
}

type SnapshotConfig struct {
	HighThresholdPercent float64
	LowThresholdPercent  float64
	GracePeriod          time.Duration
	CollectionInterval   time.Duration
}

type SSHConfig struct {
	Enabled     bool
	Port        int
	HostKeyFile string
}

func Load(name ProfileName) (*Config, error) {
	selectedProfile, err := RuntimeProfile(name)
	if err != nil {
		return nil, err
	}
	configuration := defaults(selectedProfile)
	switch name {
	case Development:
		configuration.Machine.StateDirectory = developmentMachineState
		configuration.Runtime.DataDirectory = developmentWorkloadData
		configuration.Runtime.HostServicePorts = []uint16{developmentSnapshotManagerPort}
		configuration.SSH.HostKeyFile = developmentSSHHostKeyFile
	case Production:
	default:
		return nil, fmt.Errorf("unsupported Snapflow profile %q", name)
	}
	return finalize(configuration)
}

func defaults(profile Profile) Config {
	return Config{
		Profile: profile,
		Log:     LogConfig{Level: "info"},
		API:     APIConfig{Port: defaultAPIPort},
		Jobs:    JobsConfig{PollLimit: defaultJobPollLimit},
		Metrics: MetricsConfig{
			WindowSize:                 defaultMetricsWindowSize,
			CPUUsageInterval:           defaultMetricsSampleInterval,
			AllocatedResourcesInterval: defaultMetricsSampleInterval,
		},
		Health:  HealthConfig{Interval: defaultHealthInterval, Timeout: defaultHealthTimeout},
		Usage:   UsageConfig{ReportInterval: defaultUsageReportInterval, Parallelism: defaultUsageParallelism},
		Machine: MachineConfig{StateDirectory: productionMachineState},
		Runtime: RuntimeConfig{
			DataDirectory:         "/var/lib/snapflow/workloads",
			ReleaseRoot:           profile.InstallationRoot,
			ManagementRuntimeRoot: profile.RuntimeRoot,
			PreparationTimeout:    defaultPreparationTimeout,
			Build:                 RuntimeBuildConfig{Parallelism: defaultBuildParallelism},
			Cache: RuntimeCacheConfig{
				MaximumEntries: defaultCacheMaximumEntries,
				MaximumBytes:   defaultCacheMaximumBytes,
			},
			Snapshots: SnapshotConfig{
				HighThresholdPercent: defaultSnapshotHighThresholdPercent,
				LowThresholdPercent:  defaultSnapshotLowThresholdPercent,
				GracePeriod:          defaultSnapshotGracePeriod,
				CollectionInterval:   time.Minute,
			},
		},
		SSH: SSHConfig{
			Enabled:     true,
			Port:        defaultSSHGatewayPort,
			HostKeyFile: productionSSHHostKeyFile,
		},
	}
}

func finalize(cfg Config) (*Config, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (cfg *Config) Validate() error {
	if _, err := RuntimeProfile(cfg.Profile.Name); err != nil {
		return fmt.Errorf("validate Snapflow profile: %w", err)
	}
	if cfg.Log.Level == "" {
		return errors.New("log level is required")
	}
	if err := validPort(cfg.API.Port, "API port"); err != nil {
		return err
	}
	if err := cfg.Runtime.validate(cfg.Profile.ProductionSecurity); err != nil {
		return err
	}
	if err := absolutePaths("Snapflow state directory", cfg.Machine.StateDirectory); err != nil {
		return err
	}
	if cfg.SSH.Enabled {
		if err := validPort(cfg.SSH.Port, "SSH gateway port"); err != nil {
			return err
		}
		if err := absolutePaths("SSH host key", cfg.SSH.HostKeyFile); err != nil {
			return err
		}
	}
	return nil
}

func (cfg RuntimeConfig) validate(productionSecurity bool) error {
	if err := absolutePaths(
		"runtime data, active release, and management runtime",
		cfg.DataDirectory,
		cfg.ReleaseRoot,
		cfg.ManagementRuntimeRoot,
	); err != nil {
		return err
	}
	if productionSecurity && len(cfg.HostServicePorts) > 0 {
		return errors.New("guests may only reach host services in development")
	}
	if cfg.PreparationTimeout < time.Minute || cfg.Build.Parallelism < 1 || cfg.Cache.MaximumEntries < 1 || cfg.Cache.MaximumBytes < 1 {
		return errors.New("runtime preparation, build, and cache limits must be positive")
	}
	return nil
}

func validPort(value int, name string) error {
	if value < minimumNetworkPort || value > maximumNetworkPort {
		return fmt.Errorf("%s must be between %d and %d", name, minimumNetworkPort, maximumNetworkPort)
	}
	return nil
}

func absolutePaths(name string, values ...string) error {
	for _, value := range values {
		if strings.TrimSpace(value) == "" || !filepath.IsAbs(value) {
			return fmt.Errorf("%s paths must be non-empty and absolute", name)
		}
	}
	return nil
}
