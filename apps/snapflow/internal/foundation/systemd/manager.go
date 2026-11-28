// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package systemd

import (
	"context"
	"fmt"

	sdbus "github.com/coreos/go-systemd/v22/dbus"
)

const (
	jobMode          = "replace"
	jobDone          = "done"
	runtimeUnitFiles = false
	forceUnitFiles   = false

	activeStateProperty   = "ActiveState"
	subStateProperty      = "SubState"
	unitFileStateProperty = "UnitFileState"
)

type UnitState struct {
	ActiveState   string
	SubState      string
	UnitFileState string
}

type Manager interface {
	Reload(ctx context.Context) error
	Enable(ctx context.Context, units ...string) error
	Disable(ctx context.Context, units ...string) error
	Start(ctx context.Context, unit string) error
	Stop(ctx context.Context, unit string) error
	QueueStop(ctx context.Context, units ...string) error
	State(ctx context.Context, unit string) (UnitState, error)
}

type Bus struct{}

var _ Manager = Bus{}

func (Bus) Reload(ctx context.Context) error {
	return withConnection(ctx, func(connection *sdbus.Conn) error {
		return reload(ctx, connection)
	})
}

func (Bus) Enable(ctx context.Context, units ...string) error {
	return withConnection(ctx, func(connection *sdbus.Conn) error {
		if _, _, err := connection.EnableUnitFilesContext(ctx, units, runtimeUnitFiles, forceUnitFiles); err != nil {
			return fmt.Errorf("enable %v: %w", units, err)
		}
		return reload(ctx, connection)
	})
}

func (Bus) Disable(ctx context.Context, units ...string) error {
	return withConnection(ctx, func(connection *sdbus.Conn) error {
		if _, err := connection.DisableUnitFilesContext(ctx, units, runtimeUnitFiles); err != nil {
			return fmt.Errorf("disable %v: %w", units, err)
		}
		return reload(ctx, connection)
	})
}

func (Bus) Start(ctx context.Context, unit string) error {
	return withConnection(ctx, func(connection *sdbus.Conn) error {
		return awaitJob(ctx, "start", unit, func(done chan<- string) (int, error) {
			return connection.StartUnitContext(ctx, unit, jobMode, done)
		})
	})
}

func (Bus) Stop(ctx context.Context, unit string) error {
	return withConnection(ctx, func(connection *sdbus.Conn) error {
		return awaitJob(ctx, "stop", unit, func(done chan<- string) (int, error) {
			return connection.StopUnitContext(ctx, unit, jobMode, done)
		})
	})
}

func (Bus) QueueStop(ctx context.Context, units ...string) error {
	return withConnection(ctx, func(connection *sdbus.Conn) error {
		for _, unit := range units {
			if _, err := connection.StopUnitContext(ctx, unit, jobMode, nil); err != nil {
				return fmt.Errorf("queue stop of %s: %w", unit, err)
			}
		}
		return nil
	})
}

func (Bus) State(ctx context.Context, unit string) (UnitState, error) {
	var state UnitState
	err := withConnection(ctx, func(connection *sdbus.Conn) error {
		properties, err := connection.GetUnitPropertiesContext(ctx, unit)
		if err != nil {
			return fmt.Errorf("read %s properties: %w", unit, err)
		}
		state, err = unitState(unit, properties)
		return err
	})
	return state, err
}

func unitState(unit string, properties map[string]any) (UnitState, error) {
	state := UnitState{}
	fields := []struct {
		name   string
		target *string
	}{
		{activeStateProperty, &state.ActiveState},
		{subStateProperty, &state.SubState},
		{unitFileStateProperty, &state.UnitFileState},
	}
	for _, field := range fields {
		value, ok := properties[field.name].(string)
		if !ok || value == "" {
			return UnitState{}, fmt.Errorf("systemd returned no %s for %s", field.name, unit)
		}
		*field.target = value
	}
	return state, nil
}

func withConnection(ctx context.Context, use func(*sdbus.Conn) error) error {
	connection, err := sdbus.NewSystemConnectionContext(ctx)
	if err != nil {
		return fmt.Errorf("connect to systemd: %w", err)
	}
	defer connection.Close()
	return use(connection)
}

func reload(ctx context.Context, connection *sdbus.Conn) error {
	if err := connection.ReloadContext(ctx); err != nil {
		return fmt.Errorf("reload systemd: %w", err)
	}
	return nil
}

func awaitJob(ctx context.Context, operation, unit string, enqueue func(chan<- string) (int, error)) error {
	done := make(chan string, 1)
	if _, err := enqueue(done); err != nil {
		return fmt.Errorf("%s %s: %w", operation, unit, err)
	}
	select {
	case result := <-done:
		if result != jobDone {
			return fmt.Errorf("%s %s: systemd job %s", operation, unit, result)
		}
		return nil
	case <-ctx.Done():
		return fmt.Errorf("%s %s: %w", operation, unit, ctx.Err())
	}
}
