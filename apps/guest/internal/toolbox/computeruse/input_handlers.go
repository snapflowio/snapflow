// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package computeruse

import (
	"net/http"

	"github.com/snapflowio/computer-use/plugin"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/httpx"
)

// @Summary		Get mouse position
// @Description	Get the current mouse cursor position
// @Tags			computer-use
// @Produce		json
// @Success		200	{object}	plugin.MousePositionResponse
// @Router			/computeruse/mouse/position [get]
// @id				GetMousePosition
func WrapMousePositionHandler(fn func() (*plugin.MousePositionResponse, error)) echo.HandlerFunc {
	return call(fn)
}

// @Summary		Move mouse cursor
// @Description	Move the mouse cursor to the specified coordinates
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.MouseMoveRequest	true	"Mouse move request"
// @Success		200		{object}	plugin.MousePositionResponse
// @Router			/computeruse/mouse/move [post]
// @id				MoveMouse
func WrapMoveMouseHandler(fn func(*plugin.MouseMoveRequest) (*plugin.MousePositionResponse, error)) echo.HandlerFunc {
	return bindAndCall("Invalid coordinates", fn)
}

// @Summary		Click mouse button
// @Description	Click the mouse button at the specified coordinates
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.MouseClickRequest	true	"Mouse click request"
// @Success		200		{object}	plugin.MouseClickResponse
// @Router			/computeruse/mouse/click [post]
// @id				Click
func WrapClickHandler(fn func(*plugin.MouseClickRequest) (*plugin.MouseClickResponse, error)) echo.HandlerFunc {
	return bindAndCall("Invalid click parameters", fn)
}

// @Summary		Drag mouse
// @Description	Drag the mouse from start to end coordinates
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.MouseDragRequest	true	"Mouse drag request"
// @Success		200		{object}	plugin.MouseDragResponse
// @Router			/computeruse/mouse/drag [post]
// @id				Drag
func WrapDragHandler(fn func(*plugin.MouseDragRequest) (*plugin.MouseDragResponse, error)) echo.HandlerFunc {
	return bindAndCall("Invalid drag parameters", fn)
}

// @Summary		Scroll mouse wheel
// @Description	Scroll the mouse wheel at the specified coordinates
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.MouseScrollRequest	true	"Mouse scroll request"
// @Success		200		{object}	plugin.ScrollResponse
// @Router			/computeruse/mouse/scroll [post]
// @id				Scroll
func WrapScrollHandler(fn func(*plugin.MouseScrollRequest) (*plugin.ScrollResponse, error)) echo.HandlerFunc {
	return bindAndCall("Invalid scroll parameters", fn)
}

// @Summary		Type text
// @Description	Type text with optional delay between keystrokes
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.KeyboardTypeRequest	true	"Text typing request"
// @Success		200		{object}	plugin.Empty
// @Router			/computeruse/keyboard/type [post]
// @id				TypeText
func WrapTypeTextHandler(fn func(*plugin.KeyboardTypeRequest) (*plugin.Empty, error)) echo.HandlerFunc {
	return bindAndCall("Invalid input", fn)
}

// @Summary		Press key
// @Description	Press a key with optional modifiers
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.KeyboardPressRequest	true	"Key press request"
// @Success		200		{object}	plugin.Empty
// @Router			/computeruse/keyboard/key [post]
// @id				PressKey
func WrapPressKeyHandler(fn func(*plugin.KeyboardPressRequest) (*plugin.Empty, error)) echo.HandlerFunc {
	return bindAndCall("Invalid key", fn)
}

// @Summary		Press hotkey
// @Description	Press a hotkey combination (e.g., ctrl+c, cmd+v)
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.KeyboardHotkeyRequest	true	"Hotkey press request"
// @Success		200		{object}	plugin.Empty
// @Router			/computeruse/keyboard/hotkey [post]
// @id				PressHotkey
func WrapPressHotkeyHandler(fn func(*plugin.KeyboardHotkeyRequest) (*plugin.Empty, error)) echo.HandlerFunc {
	return bindAndCall("Invalid hotkey", fn)
}

// @Summary		Get display information
// @Description	Get information about all available displays
// @Tags			computer-use
// @Produce		json
// @Success		200	{object}	plugin.DisplayInfoResponse
// @Router			/computeruse/display/info [get]
// @id				GetDisplayInfo
func WrapDisplayInfoHandler(fn func() (*plugin.DisplayInfoResponse, error)) echo.HandlerFunc {
	return call(fn)
}

// @Summary		Get windows information
// @Description	Get information about all open windows
// @Tags			computer-use
// @Produce		json
// @Success		200	{object}	plugin.WindowsResponse
// @Router			/computeruse/display/windows [get]
// @id				GetWindows
func WrapWindowsHandler(fn func() (*plugin.WindowsResponse, error)) echo.HandlerFunc {
	return call(fn)
}

// @Summary		Get computer use status
// @Description	Get the current status of the computer use system
// @Tags			computer-use
// @Produce		json
// @Success		200	{object}	plugin.ComputerUseStatusResponse
// @Router			/computeruse/status [get]
// @id				GetComputerUseSystemStatus
func WrapStatusHandler(fn func() (*plugin.ComputerUseStatusResponse, error)) echo.HandlerFunc {
	return call(fn)
}

func errorBody(message string) map[string]any {
	return map[string]any{"error": message}
}

func call[Response any](fn func() (*Response, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		response, err := fn()
		if err != nil {
			return c.JSON(http.StatusBadRequest, errorBody(err.Error()))
		}
		return c.JSON(http.StatusOK, response)
	}
}

func bindAndCall[Request, Response any](invalidMessage string, fn func(*Request) (*Response, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		var request Request
		if err := httpx.BindBody(c, &request); err != nil {
			return c.JSON(http.StatusBadRequest, errorBody(invalidMessage))
		}
		response, err := fn(&request)
		if err != nil {
			return c.JSON(http.StatusBadRequest, errorBody(err.Error()))
		}
		return c.JSON(http.StatusOK, response)
	}
}
