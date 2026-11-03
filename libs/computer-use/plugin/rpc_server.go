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

package plugin

import "errors"

type RPCServer struct {
	Impl ComputerUse
}

func (m *RPCServer) Initialize(arg any, resp *Empty) error {
	return assignEmptyResponse(resp, m.Impl.Initialize)
}

func (m *RPCServer) Start(arg any, resp *Empty) error {
	return assignEmptyResponse(resp, m.Impl.Start)
}

func (m *RPCServer) Stop(arg any, resp *Empty) error {
	return assignEmptyResponse(resp, m.Impl.Stop)
}

func (m *RPCServer) GetProcessStatus(arg any, resp *map[string]ProcessStatus) error {
	status, err := m.Impl.GetProcessStatus()
	if err != nil {
		return err
	}
	*resp = status
	return nil
}

func (m *RPCServer) IsProcessRunning(arg *ProcessRequest, resp *bool) error {
	isRunning, err := m.Impl.IsProcessRunning(arg)
	if err != nil {
		return err
	}
	*resp = isRunning
	return nil
}

func (m *RPCServer) RestartProcess(arg *ProcessRequest, resp *Empty) error {
	return assignEmptyResponse(resp, func() (*Empty, error) { return m.Impl.RestartProcess(arg) })
}

func (m *RPCServer) GetProcessLogs(arg *ProcessRequest, resp *string) error {
	logs, err := m.Impl.GetProcessLogs(arg)
	if err != nil {
		return err
	}
	*resp = logs
	return nil
}

func (m *RPCServer) GetProcessErrors(arg *ProcessRequest, resp *string) error {
	errors, err := m.Impl.GetProcessErrors(arg)
	if err != nil {
		return err
	}
	*resp = errors
	return nil
}

func (m *RPCServer) TakeScreenshot(arg *ScreenshotRequest, resp *ScreenshotResponse) error {
	response, err := m.Impl.TakeScreenshot(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) TakeRegionScreenshot(arg *RegionScreenshotRequest, resp *ScreenshotResponse) error {
	response, err := m.Impl.TakeRegionScreenshot(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) TakeCompressedScreenshot(arg *CompressedScreenshotRequest, resp *ScreenshotResponse) error {
	response, err := m.Impl.TakeCompressedScreenshot(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) TakeCompressedRegionScreenshot(arg *CompressedRegionScreenshotRequest, resp *ScreenshotResponse) error {
	response, err := m.Impl.TakeCompressedRegionScreenshot(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) GetMousePosition(arg any, resp *MousePositionResponse) error {
	response, err := m.Impl.GetMousePosition()
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) MoveMouse(arg *MouseMoveRequest, resp *MousePositionResponse) error {
	response, err := m.Impl.MoveMouse(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) Click(arg *MouseClickRequest, resp *MouseClickResponse) error {
	response, err := m.Impl.Click(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) Drag(arg *MouseDragRequest, resp *MouseDragResponse) error {
	response, err := m.Impl.Drag(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) Scroll(arg *MouseScrollRequest, resp *ScrollResponse) error {
	response, err := m.Impl.Scroll(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) TypeText(arg *KeyboardTypeRequest, resp *Empty) error {
	return assignEmptyResponse(resp, func() (*Empty, error) { return m.Impl.TypeText(arg) })
}

func (m *RPCServer) PressKey(arg *KeyboardPressRequest, resp *Empty) error {
	return assignEmptyResponse(resp, func() (*Empty, error) { return m.Impl.PressKey(arg) })
}

func (m *RPCServer) PressHotkey(arg *KeyboardHotkeyRequest, resp *Empty) error {
	return assignEmptyResponse(resp, func() (*Empty, error) { return m.Impl.PressHotkey(arg) })
}

func (m *RPCServer) GetDisplayInfo(arg any, resp *DisplayInfoResponse) error {
	response, err := m.Impl.GetDisplayInfo()
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) GetWindows(arg any, resp *WindowsResponse) error {
	response, err := m.Impl.GetWindows()
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) GetStatus(arg any, resp *ComputerUseStatusResponse) error {
	response, err := m.Impl.GetStatus()
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) GetAccessibilityTree(arg *GetAccessibilityTreeRequest, resp *AccessibilityTreeResponse) error {
	response, err := m.Impl.GetAccessibilityTree(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) FindAccessibilityNodes(arg *FindAccessibilityNodesRequest, resp *AccessibilityNodesResponse) error {
	response, err := m.Impl.FindAccessibilityNodes(arg)
	if err != nil {
		return err
	}
	*resp = *response
	return nil
}

func (m *RPCServer) FocusAccessibilityNode(arg *AccessibilityNodeRequest, resp *Empty) error {
	return assignEmptyResponse(resp, func() (*Empty, error) { return m.Impl.FocusAccessibilityNode(arg) })
}

func (m *RPCServer) InvokeAccessibilityNode(arg *AccessibilityInvokeRequest, resp *Empty) error {
	return assignEmptyResponse(resp, func() (*Empty, error) { return m.Impl.InvokeAccessibilityNode(arg) })
}

func (m *RPCServer) SetAccessibilityNodeValue(arg *AccessibilitySetValueRequest, resp *Empty) error {
	return assignEmptyResponse(resp, func() (*Empty, error) { return m.Impl.SetAccessibilityNodeValue(arg) })
}

func assignEmptyResponse(destination *Empty, operation func() (*Empty, error)) error {
	response, err := operation()
	if err != nil {
		return err
	}
	if response == nil {
		return errors.New("computer-use operation returned no response")
	}
	*destination = *response
	return nil
}
