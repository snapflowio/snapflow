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

package cloudhypervisor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/socketdial"
)

const vmmRequestTimeout = 120 * time.Second

const maxVMMResponseBytes = 1 << 20

type client struct {
	socketPath string
	client     *http.Client
}

func newClient(socketPath string) *client {
	transport := &http.Transport{
		DialContext:       socketdial.Unix(socketPath),
		DisableKeepAlives: true,
	}
	return &client{
		socketPath: socketPath,
		client: &http.Client{
			Transport: transport,
			Timeout:   vmmRequestTimeout,
		},
	}
}

func (c *client) CreateAndBoot(ctx context.Context, cfg hypervisor.VM) error {
	if _, err := c.do(ctx, http.MethodPut, "/api/v1/vm.create", toVMConfig(cfg), http.StatusNoContent); err != nil {
		return fmt.Errorf("create cloud-hypervisor vm: %w", err)
	}
	if _, err := c.do(ctx, http.MethodPut, "/api/v1/vm.boot", nil, http.StatusNoContent); err != nil {
		return fmt.Errorf("boot cloud-hypervisor vm: %w", err)
	}
	return nil
}

func (c *client) DeleteVM(ctx context.Context) error {
	_, err := c.do(ctx, http.MethodPut, "/api/v1/vm.delete", nil, http.StatusNoContent)
	return err
}

func (c *client) Pause(ctx context.Context) error {
	_, err := c.do(ctx, http.MethodPut, "/api/v1/vm.pause", nil, http.StatusNoContent)
	return err
}

func (c *client) Resume(ctx context.Context) error {
	_, err := c.do(ctx, http.MethodPut, "/api/v1/vm.resume", nil, http.StatusNoContent)
	return err
}

func (c *client) Snapshot(ctx context.Context, destPath string) error {
	if err := os.MkdirAll(destPath, filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create cloud-hypervisor snapshot directory: %w", err)
	}
	destinationURL := "file://" + destPath
	_, err := c.do(ctx, http.MethodPut, "/api/v1/vm.snapshot", vmSnapshotConfig{DestinationURL: &destinationURL}, http.StatusNoContent)
	return err
}

func (c *client) Restore(ctx context.Context, sourcePath string) error {
	sourceURL := "file://" + sourcePath
	prefault := false
	_, err := c.do(ctx, http.MethodPut, "/api/v1/vm.restore", restoreConfig{SourceURL: sourceURL, Prefault: &prefault}, http.StatusNoContent)
	return err
}

func (c *client) ShutdownVMM(ctx context.Context) error {
	_, err := c.do(ctx, http.MethodPut, "/api/v1/vmm.shutdown", nil, http.StatusNoContent)
	return err
}

func (c *client) Info(ctx context.Context) (hypervisor.VMInfo, error) {
	data, err := c.do(ctx, http.MethodGet, "/api/v1/vm.info", nil, http.StatusOK)
	if err != nil {
		return hypervisor.VMInfo{}, err
	}
	var info vmInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return hypervisor.VMInfo{}, fmt.Errorf("decode cloud-hypervisor info: %w", err)
	}
	vmState, err := hypervisor.ParseVMState(info.State)
	if err != nil {
		return hypervisor.VMInfo{}, fmt.Errorf("decode cloud-hypervisor VM state: %w", err)
	}
	return hypervisor.VMInfo{State: vmState}, nil
}

func (c *client) do(ctx context.Context, method, path string, requestBody any, expectedStatus ...int) ([]byte, error) {
	var body io.Reader
	if requestBody != nil {
		data, err := json.Marshal(requestBody)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		body = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, "http://localhost"+path, body)
	if err != nil {
		return nil, fmt.Errorf("create cloud-hypervisor request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if requestBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cloud-hypervisor %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxVMMResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read cloud-hypervisor response: %w", err)
	}
	if len(data) > maxVMMResponseBytes {
		return nil, fmt.Errorf("cloud-hypervisor response exceeds %d byte limit", maxVMMResponseBytes)
	}
	for _, status := range expectedStatus {
		if resp.StatusCode == status {
			return data, nil
		}
	}
	return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(data))
}
