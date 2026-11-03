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

type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
} //	@name	Position

type Size struct {
	Width  int `json:"width"`
	Height int `json:"height"`
} //	@name	Size

type ScreenshotRequest struct {
	ShowCursor bool `json:"showCursor"`
} //	@name	ScreenshotRequest

type RegionScreenshotRequest struct {
	Position
	Size
	ShowCursor bool `json:"showCursor"`
} //	@name	RegionScreenshotRequest

type CompressedScreenshotRequest struct {
	ShowCursor bool    `json:"showCursor"`
	Format     string  `json:"format"`
	Quality    int     `json:"quality"`
	Scale      float64 `json:"scale"`
} //	@name	CompressedScreenshotRequest

type CompressedRegionScreenshotRequest struct {
	Position
	Size
	ShowCursor bool    `json:"showCursor"`
	Format     string  `json:"format"`
	Quality    int     `json:"quality"`
	Scale      float64 `json:"scale"`
} //	@name	CompressedRegionScreenshotRequest

type MouseMoveRequest struct {
	Position
} //	@name	MouseMoveRequest

type MouseClickRequest struct {
	Position
	Button string `json:"button"` // left, right, middle
	Double bool   `json:"double"`
} //	@name	MouseClickRequest

type MouseDragRequest struct {
	StartX int    `json:"startX"`
	StartY int    `json:"startY"`
	EndX   int    `json:"endX"`
	EndY   int    `json:"endY"`
	Button string `json:"button"`
} //	@name	MouseDragRequest

type MouseScrollRequest struct {
	Position
	Direction string `json:"direction"` // up, down
	Amount    int    `json:"amount" minimum:"0" default:"1"`
} //	@name	MouseScrollRequest

type KeyboardTypeRequest struct {
	Text  string `json:"text"`
	Delay int    `json:"delay"` // milliseconds between keystrokes
} //	@name	KeyboardTypeRequest

type KeyboardPressRequest struct {
	Key       string   `json:"key"`
	Modifiers []string `json:"modifiers"` // ctrl, alt, shift, cmd
} //	@name	KeyboardPressRequest

type KeyboardHotkeyRequest struct {
	Keys string `json:"keys"` // e.g., "ctrl+c", "cmd+v"
} //	@name	KeyboardHotkeyRequest

type ScrollResponse struct {
	Success bool `json:"success"`
} //	@name	ScrollResponse

type ScreenshotResponse struct {
	Screenshot     string    `json:"screenshot"`
	CursorPosition *Position `json:"cursorPosition,omitempty"`
	SizeBytes      int       `json:"sizeBytes,omitempty"`
} //	@name	ScreenshotResponse

type MousePositionResponse struct {
	Position
} //	@name	MousePositionResponse

type MouseClickResponse struct {
	Position
} //	@name	MouseClickResponse

type MouseDragResponse struct {
	Position
} //	@name	MouseDragResponse

type DisplayInfoResponse struct {
	Displays []DisplayInfo `json:"displays"`
} //	@name	DisplayInfoResponse

type DisplayInfo struct {
	ID int `json:"id"`
	Position
	Size
	IsActive bool `json:"isActive"`
} //	@name	DisplayInfo

type WindowsResponse struct {
	Windows []WindowInfo `json:"windows"`
} //	@name	WindowsResponse

type WindowInfo struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	Position
	Size
	IsActive bool `json:"isActive"`
} //	@name	WindowInfo

type ComputerUseStatusResponse struct {
	Status string `json:"status"`
} //	@name	ComputerUseStatusResponse

type ProcessStatus struct {
	Running     bool `json:"running"`
	Priority    int  `json:"priority"`
	AutoRestart bool `json:"autoRestart"`
	Pid         *int `json:"pid,omitempty"`
} //	@name	ProcessStatus

type ProcessRequest struct {
	ProcessName string
} //	@name	ProcessRequest

type Empty struct{} //	@name	Empty

type AccessibilityBounds struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
} //	@name	AccessibilityBounds

type AccessibilityNode struct {
	ID          string               `json:"id"`
	Role        string               `json:"role"`
	Name        string               `json:"name"`
	Description string               `json:"description,omitempty"`
	Bounds      AccessibilityBounds  `json:"bounds"`
	States      []string             `json:"states"`
	Actions     []string             `json:"actions,omitempty"`
	Children    []*AccessibilityNode `json:"children,omitempty"`
} //	@name	AccessibilityNode

type GetAccessibilityTreeRequest struct {
	Scope    string `json:"scope" query:"scope"`
	PID      int    `json:"pid" query:"pid"`
	MaxDepth int    `json:"maxDepth" query:"maxDepth"`
} //	@name	GetAccessibilityTreeRequest

type AccessibilityTreeResponse struct {
	Root      AccessibilityNode `json:"root"`
	Truncated bool              `json:"truncated"`
} //	@name	AccessibilityTreeResponse

type FindAccessibilityNodesRequest struct {
	Scope     string   `json:"scope"`
	PID       int      `json:"pid,omitempty"`
	Role      string   `json:"role,omitempty"`
	Name      string   `json:"name,omitempty"`
	NameMatch string   `json:"nameMatch,omitempty"` // "exact" | "substring" | "regex"
	States    []string `json:"states,omitempty"`
	Limit     int      `json:"limit,omitempty"`
} //	@name	FindAccessibilityNodesRequest

type AccessibilityNodesResponse struct {
	Matches   []AccessibilityNode `json:"matches"`
	Truncated bool                `json:"truncated"`
} //	@name	AccessibilityNodesResponse

type AccessibilityNodeRequest struct {
	ID string `json:"id" binding:"required"`
} //	@name	AccessibilityNodeRequest

type AccessibilityInvokeRequest struct {
	ID     string `json:"id" binding:"required"`
	Action string `json:"action,omitempty"`
} //	@name	AccessibilityInvokeRequest

type AccessibilitySetValueRequest struct {
	ID    string `json:"id" binding:"required"`
	Value string `json:"value"`
} //	@name	AccessibilitySetValueRequest
