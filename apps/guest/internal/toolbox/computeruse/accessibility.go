// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package computeruse

import (
	"net/http"
	"strings"

	"github.com/snapflowio/computer-use/plugin"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/httpx"
)

func writeA11yInvalidRequest(c *echo.Context, msg string) error {
	return c.JSON(http.StatusBadRequest, map[string]any{
		"error": msg,
		"code":  "A11Y_INVALID_REQUEST",
	})
}

func hasA11ySentinel(msg, sentinel string) bool {
	return msg == sentinel || strings.HasPrefix(msg, sentinel+":")
}

func writeA11yError(c *echo.Context, err error) error {
	msg := err.Error()
	switch {
	case hasA11ySentinel(msg, plugin.A11yUnavailableMessage):
		return c.JSON(http.StatusServiceUnavailable, map[string]any{
			"error": msg,
			"code":  "A11Y_UNAVAILABLE",
		})
	case hasA11ySentinel(msg, plugin.A11yNodeNotFoundMessage):
		return c.JSON(http.StatusNotFound, map[string]any{
			"error": msg,
			"code":  "A11Y_NODE_NOT_FOUND",
		})
	case hasA11ySentinel(msg, plugin.A11yNoAccessibleRootMessage):
		return c.JSON(http.StatusNotFound, map[string]any{
			"error": msg,
			"code":  "A11Y_NO_ACCESSIBLE_ROOT",
		})
	case hasA11ySentinel(msg, plugin.A11yActionNotSupportedMessage):
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": msg,
			"code":  "A11Y_ACTION_NOT_SUPPORTED",
		})
	case hasA11ySentinel(msg, plugin.A11yInvalidScopeMessage):
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": msg,
			"code":  "A11Y_INVALID_SCOPE",
		})
	case hasA11ySentinel(msg, plugin.A11yInvalidRequestMessage):
		return writeA11yInvalidRequest(c, msg)
	default:
		return c.JSON(http.StatusInternalServerError, map[string]any{
			"error": msg,
			"code":  "A11Y_INTERNAL",
		})
	}
}

// @Summary		Get accessibility tree
// @Description	Fetch the AT-SPI accessibility tree for the focused application, a specific PID, or all registered applications.
// @Tags			computer-use
// @Produce		json
// @Param			scope		query		string	false	"Scope: focused | pid | all (default: focused)"
// @Param			pid			query		int		false	"Process ID when scope=pid"
// @Param			maxDepth	query		int		false	"Max tree depth (-1 unbounded, 0 root only; default -1)"
// @Success		200			{object}	plugin.AccessibilityTreeResponse
// @Failure		400			{object}	map[string]string
// @Failure		404			{object}	map[string]string
// @Failure		500			{object}	map[string]string
// @Failure		503			{object}	map[string]string
// @Router			/computeruse/a11y/tree [get]
// @id				GetAccessibilityTree
func WrapGetAccessibilityTreeHandler(fn func(*plugin.GetAccessibilityTreeRequest) (*plugin.AccessibilityTreeResponse, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		req := &plugin.GetAccessibilityTreeRequest{MaxDepth: -1}
		if err := httpx.BindQuery(c, req); err != nil {
			return writeA11yInvalidRequest(c, err.Error())
		}
		if c.QueryParam("maxDepth") == "" {
			req.MaxDepth = -1
		}
		if req.Scope == "" {
			req.Scope = "focused"
		}

		response, err := fn(req)
		if err != nil {
			return writeA11yError(c, err)
		}
		return c.JSON(http.StatusOK, response)
	}
}

// @Summary		Find accessibility nodes
// @Description	Search the AT-SPI tree for nodes matching a role/name/state filter and return a flat list.
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.FindAccessibilityNodesRequest	true	"Find request"
// @Success		200		{object}	plugin.AccessibilityNodesResponse
// @Failure		400		{object}	map[string]string
// @Failure		404		{object}	map[string]string
// @Failure		500		{object}	map[string]string
// @Failure		503		{object}	map[string]string
// @Router			/computeruse/a11y/find [post]
// @id				FindAccessibilityNodes
func WrapFindAccessibilityNodesHandler(fn func(*plugin.FindAccessibilityNodesRequest) (*plugin.AccessibilityNodesResponse, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		var req plugin.FindAccessibilityNodesRequest
		if err := httpx.BindBody(c, &req); err != nil {
			return writeA11yInvalidRequest(c, err.Error())
		}
		response, err := fn(&req)
		if err != nil {
			return writeA11yError(c, err)
		}
		return c.JSON(http.StatusOK, response)
	}
}

// @Summary		Focus an accessibility node
// @Description	Move keyboard focus to the AT-SPI node identified by id (bus-name:object-path).
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.AccessibilityNodeRequest	true	"Node focus request"
// @Success		200		{object}	plugin.Empty
// @Failure		400		{object}	map[string]string
// @Failure		404		{object}	map[string]string
// @Failure		500		{object}	map[string]string
// @Failure		503		{object}	map[string]string
// @Router			/computeruse/a11y/node/focus [post]
// @id				FocusAccessibilityNode
func WrapFocusAccessibilityNodeHandler(fn func(*plugin.AccessibilityNodeRequest) (*plugin.Empty, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		var req plugin.AccessibilityNodeRequest
		if err := httpx.BindBody(c, &req); err != nil {
			return writeA11yInvalidRequest(c, err.Error())
		}
		response, err := fn(&req)
		if err != nil {
			return writeA11yError(c, err)
		}
		return c.JSON(http.StatusOK, response)
	}
}

// @Summary		Invoke an action on an accessibility node
// @Description	Call an AT-SPI Action on the node. Leave action empty to invoke the node's primary (first) action.
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.AccessibilityInvokeRequest	true	"Invoke request"
// @Success		200		{object}	plugin.Empty
// @Failure		400		{object}	map[string]string
// @Failure		404		{object}	map[string]string
// @Failure		500		{object}	map[string]string
// @Failure		503		{object}	map[string]string
// @Router			/computeruse/a11y/node/invoke [post]
// @id				InvokeAccessibilityNode
func WrapInvokeAccessibilityNodeHandler(fn func(*plugin.AccessibilityInvokeRequest) (*plugin.Empty, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		var req plugin.AccessibilityInvokeRequest
		if err := httpx.BindBody(c, &req); err != nil {
			return writeA11yInvalidRequest(c, err.Error())
		}
		response, err := fn(&req)
		if err != nil {
			return writeA11yError(c, err)
		}
		return c.JSON(http.StatusOK, response)
	}
}

// @Summary		Set the value of an accessibility node
// @Description	Write the given value to the node via EditableText.SetTextContents or, for numeric controls, Value.CurrentValue.
// @Tags			computer-use
// @Accept			json
// @Produce		json
// @Param			request	body		plugin.AccessibilitySetValueRequest	true	"Set value request"
// @Success		200		{object}	plugin.Empty
// @Failure		400		{object}	map[string]string
// @Failure		404		{object}	map[string]string
// @Failure		500		{object}	map[string]string
// @Failure		503		{object}	map[string]string
// @Router			/computeruse/a11y/node/value [post]
// @id				SetAccessibilityNodeValue
func WrapSetAccessibilityNodeValueHandler(fn func(*plugin.AccessibilitySetValueRequest) (*plugin.Empty, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		var req plugin.AccessibilitySetValueRequest
		if err := httpx.BindBody(c, &req); err != nil {
			return writeA11yInvalidRequest(c, err.Error())
		}
		response, err := fn(&req)
		if err != nil {
			return writeA11yError(c, err)
		}
		return c.JSON(http.StatusOK, response)
	}
}
