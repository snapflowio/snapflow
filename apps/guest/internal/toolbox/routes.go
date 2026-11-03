// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package toolbox

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/computer-use/plugin"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/toolbox/computeruse"
	"github.com/snapflowio/guest/internal/toolbox/fs"
	"github.com/snapflowio/guest/internal/toolbox/git"
	"github.com/snapflowio/guest/internal/toolbox/lsp"
	"github.com/snapflowio/guest/internal/toolbox/process"
	"github.com/snapflowio/guest/internal/toolbox/process/coderun"
	"github.com/snapflowio/guest/internal/toolbox/process/interpreter"
	"github.com/snapflowio/guest/internal/toolbox/process/pty"
	"github.com/snapflowio/guest/internal/toolbox/process/session"
	"github.com/snapflowio/guest/internal/toolbox/proxy"
)

const internalServerErrorCode = "INTERNAL_SERVER_ERROR"

type portHandlers interface {
	GetPorts(ctx *echo.Context) error
	IsPortInUse(ctx *echo.Context) error
}

type routerDeps struct {
	ComputerUse *computeruse.LazyComputerUse
	Interpreter *interpreter.Controller
	Ports       portHandlers
}

func (s *Server) newRouter(deps routerDeps) *echo.Echo {
	r := echo.NewWithConfig(echo.Config{
		Logger: s.logger,
		HTTPErrorHandler: common_errors.NewHTTPErrorHandler(func(ctx *echo.Context, err error) common_errors.ErrorResponse {
			request := ctx.Request()
			return common_errors.ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Message:    err.Error(),
				Code:       internalServerErrorCode,
				Timestamp:  time.Now(),
				Path:       request.URL.Path,
				Method:     request.Method,
			}
		}),
		Validator: new(DefaultValidator),
	})
	r.Use(common_errors.Recovery())
	r.Use(middleware.RequestLogger())
	r.Use(newCredentialMiddleware(s.cfg.AuthHeader, s.cfg.AuthTokenFile))

	registerSwagger(r)

	r.GET("/version", s.GetVersion)
	r.GET("/user-home-dir", s.GetUserHomeDir)
	r.GET("/work-dir", s.GetWorkDir)

	registerFileRoutes(r.Group("/files"))
	s.registerProcessRoutes(r.Group("/process"), deps.Interpreter)
	registerGitRoutes(r.Group("/git"), s.reaper)
	registerLSPRoutes(r.Group("/lsp"), lsp.NewController(s.logger))
	computerUseGroup := r.Group("/computeruse")
	registerComputerUseRoutes(computerUseGroup, deps.ComputerUse)

	portGroup := r.Group("/port")
	portGroup.GET("", deps.Ports.GetPorts)
	portGroup.GET("/:port/in-use", deps.Ports.IsPortInUse)

	r.Group("/proxy").Any("/:"+proxy.PortParameter+"/*", proxy.New(s.logger).Serve)
	return r
}

func registerFileRoutes(group *echo.Group) {
	group.GET("/", fs.ListFiles)
	group.GET("", fs.ListFiles)
	group.GET("/download", fs.DownloadFile)
	group.POST("/bulk-download", fs.DownloadFiles)
	group.GET("/find", fs.FindInFiles)
	group.GET("/info", fs.GetFileInfo)
	group.GET("/search", fs.SearchFiles)

	group.POST("/folder", fs.CreateFolder)
	group.POST("/move", fs.MoveFile)
	group.POST("/permissions", fs.SetFilePermissions)
	group.POST("/replace", fs.ReplaceInFiles)
	group.POST("/upload", fs.UploadFile)
	group.POST("/bulk-upload", fs.UploadFiles)

	group.DELETE("/", fs.DeleteFile)
	group.DELETE("", fs.DeleteFile)
}

func (s *Server) registerProcessRoutes(group *echo.Group, interpreterController *interpreter.Controller) {
	group.POST("/execute", process.ExecuteCommand(s.reaper))
	group.POST("/code-run", coderun.CodeRun(s.reaper))

	sessionController := session.NewSessionController(s.logger, s.sessions)
	sessionGroup := group.Group("/session")
	sessionGroup.GET("", sessionController.ListSessions)
	sessionGroup.POST("", sessionController.CreateSession)
	sessionGroup.GET("/entrypoint", sessionController.GetEntrypointSession)
	sessionGroup.GET("/entrypoint/logs", sessionController.GetEntrypointLogs)
	sessionGroup.POST("/:sessionId/exec", sessionController.SessionExecuteCommand)
	sessionGroup.GET("/:sessionId", sessionController.GetSession)
	sessionGroup.DELETE("/:sessionId", sessionController.DeleteSession)
	sessionGroup.GET("/:sessionId/command/:commandId", sessionController.GetSessionCommand)
	sessionGroup.POST("/:sessionId/command/:commandId/input", sessionController.SendInput)
	sessionGroup.GET("/:sessionId/command/:commandId/logs", sessionController.GetSessionCommandLogs)

	ptyController := pty.NewPTYController(s.logger, s.reaper, s.cfg.WorkDir)
	ptyGroup := group.Group("/pty")
	ptyGroup.GET("", ptyController.ListPTYSessions)
	ptyGroup.POST("", ptyController.CreatePTYSession)
	ptyGroup.GET("/:sessionId", ptyController.GetPTYSession)
	ptyGroup.DELETE("/:sessionId", ptyController.DeletePTYSession)
	ptyGroup.GET("/:sessionId/connect", ptyController.ConnectPTYSession)
	ptyGroup.POST("/:sessionId/resize", ptyController.ResizePTYSession)

	interpreterGroup := group.Group("/interpreter")
	interpreterGroup.POST("/context", interpreterController.CreateContext)
	interpreterGroup.GET("/context", interpreterController.ListContexts)
	interpreterGroup.DELETE("/context/:id", interpreterController.DeleteContext)
	interpreterGroup.GET("/execute", interpreterController.Execute)
}

func registerGitRoutes(group *echo.Group, reaper *childreap.Reaper) {
	group.GET("/branches", git.ListBranches)
	group.GET("/history", git.GetCommitHistory)
	group.GET("/status", git.GetStatus(reaper))

	group.POST("/add", git.AddFiles)
	group.POST("/branches", git.CreateBranch)
	group.POST("/checkout", git.CheckoutBranch)
	group.DELETE("/branches", git.DeleteBranch)
	group.POST("/clone", git.CloneRepository)
	group.POST("/commit", git.CommitChanges)
	group.POST("/pull", git.PullChanges)
	group.POST("/push", git.PushChanges)
}

func registerLSPRoutes(group *echo.Group, controller *lsp.Controller) {
	group.POST("/start", controller.Start)
	group.POST("/stop", controller.Stop)

	group.POST("/completions", controller.Completions)
	group.POST("/did-open", controller.DidOpen)
	group.POST("/did-close", controller.DidClose)

	group.GET("/document-symbols", controller.DocumentSymbols)
	group.GET("/workspacesymbols", controller.WorkspaceSymbols)
}

func registerComputerUseRoutes(group *echo.Group, lazy *computeruse.LazyComputerUse) {
	group.GET("/status", computeruse.WrapStatusHandler(lazy.GetStatus))

	handler := computeruse.Handler{ComputerUse: lazy}
	routes := group.Group("", computeruse.AvailabilityMiddleware(lazy))

	routes.POST("/start", handler.StartComputerUse)
	routes.POST("/stop", handler.StopComputerUse)
	routes.GET("/process-status", handler.GetComputerUseStatus)
	routes.GET("/process/:processName/status", handler.GetProcessStatus)
	routes.POST("/process/:processName/restart", handler.RestartProcess)
	routes.GET("/process/:processName/logs", handler.GetProcessLogs)
	routes.GET("/process/:processName/errors", handler.GetProcessErrors)

	routes.GET("/screenshot", computeruse.WrapScreenshotHandler(computeruse.CallWith(lazy, plugin.ComputerUse.TakeScreenshot)))
	routes.GET("/screenshot/region", computeruse.WrapRegionScreenshotHandler(computeruse.CallWith(lazy, plugin.ComputerUse.TakeRegionScreenshot)))
	routes.GET("/screenshot/compressed", computeruse.WrapCompressedScreenshotHandler(computeruse.CallWith(lazy, plugin.ComputerUse.TakeCompressedScreenshot)))
	routes.GET("/screenshot/region/compressed", computeruse.WrapCompressedRegionScreenshotHandler(computeruse.CallWith(lazy, plugin.ComputerUse.TakeCompressedRegionScreenshot)))

	routes.GET("/mouse/position", computeruse.WrapMousePositionHandler(computeruse.Call(lazy, plugin.ComputerUse.GetMousePosition)))
	routes.POST("/mouse/move", computeruse.WrapMoveMouseHandler(computeruse.CallWith(lazy, plugin.ComputerUse.MoveMouse)))
	routes.POST("/mouse/click", computeruse.WrapClickHandler(computeruse.CallWith(lazy, plugin.ComputerUse.Click)))
	routes.POST("/mouse/drag", computeruse.WrapDragHandler(computeruse.CallWith(lazy, plugin.ComputerUse.Drag)))
	routes.POST("/mouse/scroll", computeruse.WrapScrollHandler(computeruse.CallWith(lazy, plugin.ComputerUse.Scroll)))

	routes.POST("/keyboard/type", computeruse.WrapTypeTextHandler(computeruse.CallWith(lazy, plugin.ComputerUse.TypeText)))
	routes.POST("/keyboard/key", computeruse.WrapPressKeyHandler(computeruse.CallWith(lazy, plugin.ComputerUse.PressKey)))
	routes.POST("/keyboard/hotkey", computeruse.WrapPressHotkeyHandler(computeruse.CallWith(lazy, plugin.ComputerUse.PressHotkey)))

	routes.GET("/display/info", computeruse.WrapDisplayInfoHandler(computeruse.Call(lazy, plugin.ComputerUse.GetDisplayInfo)))
	routes.GET("/display/windows", computeruse.WrapWindowsHandler(computeruse.Call(lazy, plugin.ComputerUse.GetWindows)))

	routes.GET("/a11y/tree", computeruse.WrapGetAccessibilityTreeHandler(computeruse.CallWith(lazy, plugin.ComputerUse.GetAccessibilityTree)))
	routes.POST("/a11y/find", computeruse.WrapFindAccessibilityNodesHandler(computeruse.CallWith(lazy, plugin.ComputerUse.FindAccessibilityNodes)))
	routes.POST("/a11y/node/focus", computeruse.WrapFocusAccessibilityNodeHandler(computeruse.CallWith(lazy, plugin.ComputerUse.FocusAccessibilityNode)))
	routes.POST("/a11y/node/invoke", computeruse.WrapInvokeAccessibilityNodeHandler(computeruse.CallWith(lazy, plugin.ComputerUse.InvokeAccessibilityNode)))
	routes.POST("/a11y/node/value", computeruse.WrapSetAccessibilityNodeValueHandler(computeruse.CallWith(lazy, plugin.ComputerUse.SetAccessibilityNodeValue)))
}
