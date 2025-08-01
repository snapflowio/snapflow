package toolbox

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"path"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/snapflowio/node/internal"
	"github.com/snapflowio/node/pkg/toolbox/config"
	"github.com/snapflowio/node/pkg/toolbox/fs"
	"github.com/snapflowio/node/pkg/toolbox/git"
	"github.com/snapflowio/node/pkg/toolbox/lsp"
	"github.com/snapflowio/node/pkg/toolbox/middlewares"
	"github.com/snapflowio/node/pkg/toolbox/port"
	"github.com/snapflowio/node/pkg/toolbox/process"
	"github.com/snapflowio/node/pkg/toolbox/process/session"
	"github.com/snapflowio/node/pkg/toolbox/proxy"

	"github.com/rs/zerolog/log"
)

type Server struct {
	ProjectDir string
}

type ProjectDirResponse struct {
	Dir string `json:"dir"`
} // @name ProjectDirResponse

func (s *Server) GetProjectDir(c echo.Context) error {
	projectDir := ProjectDirResponse{
		Dir: s.ProjectDir,
	}

	return c.JSON(http.StatusOK, projectDir)
}

func (s *Server) Start() error {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Use(middleware.Recover())
	e.Use(middlewares.LoggingMiddleware())
	e.Use(middlewares.ErrorMiddleware())
	e.Validator = NewDefaultValidator()

	e.GET("/version", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]any{
			"version": internal.Version,
		})
	})

	e.GET("/project-dir", s.GetProjectDir)

	dirname, err := os.UserHomeDir()
	if err != nil {
		log.Fatal().Msg(err.Error())
	}

	configDir := path.Join(dirname, ".snapflow")
	err = os.MkdirAll(configDir, 0755)
	if err != nil {
		log.Fatal().Msg(err.Error())
	}

	log.Info().Str("configDir", configDir).Msg("Configuration directory")

	fsController := e.Group("/files")
	{
		// read operations
		fsController.GET("/", fs.ListFiles)
		fsController.GET("/download", fs.DownloadFile)
		fsController.GET("/find", fs.FindInFiles)
		fsController.GET("/info", fs.GetFileInfo)
		fsController.GET("/search", fs.SearchFiles)

		// create/modify operations
		fsController.POST("/folder", fs.CreateFolder)
		fsController.POST("/move", fs.MoveFile)
		fsController.POST("/permissions", fs.SetFilePermissions)
		fsController.POST("/replace", fs.ReplaceInFiles)
		fsController.POST("/upload", fs.UploadFile)
		fsController.POST("/bulk-upload", fs.UploadFiles)

		// delete operations
		fsController.DELETE("/", fs.DeleteFile)
	}

	processController := e.Group("/process")
	{
		processController.POST("/execute", process.ExecuteCommand)

		sessionController := session.NewSessionController(configDir, s.ProjectDir)
		sessionGroup := processController.Group("/session")
		{
			sessionGroup.GET("", sessionController.ListSessions)
			sessionGroup.POST("", sessionController.CreateSession)
			sessionGroup.POST("/:sessionId/exec", sessionController.SessionExecuteCommand)
			sessionGroup.GET("/:sessionId", sessionController.GetSession)
			sessionGroup.DELETE("/:sessionId", sessionController.DeleteSession)
			sessionGroup.GET("/:sessionId/command/:commandId", sessionController.GetSessionCommand)
			sessionGroup.GET("/:sessionId/command/:commandId/logs", sessionController.GetSessionCommandLogs)
		}
	}

	gitController := e.Group("/git")
	{
		gitController.GET("/branches", git.ListBranches)
		gitController.GET("/history", git.GetCommitHistory)
		gitController.GET("/status", git.GetStatus)

		gitController.POST("/add", git.AddFiles)
		gitController.POST("/branches", git.CreateBranch)
		gitController.POST("/checkout", git.CheckoutBranch)
		gitController.DELETE("/branches", git.DeleteBranch)
		gitController.POST("/clone", git.CloneRepository)
		gitController.POST("/commit", git.CommitChanges)
		gitController.POST("/pull", git.PullChanges)
		gitController.POST("/push", git.PushChanges)
	}

	lspController := e.Group("/lsp")
	{
		//	server process
		lspController.POST("/start", lsp.Start)
		lspController.POST("/stop", lsp.Stop)

		//	lsp operations
		lspController.POST("/completions", lsp.Completions)
		lspController.POST("/did-open", lsp.DidOpen)
		lspController.POST("/did-close", lsp.DidClose)

		lspController.GET("/document-symbols", lsp.DocumentSymbols)
		lspController.GET("/workspacesymbols", lsp.WorkspaceSymbols)
	}

	portDetector := port.NewPortsDetector()

	portController := e.Group("/port")
	{
		portController.GET("", portDetector.GetPorts)
		portController.GET("/:port/in-use", portDetector.IsPortInUse)
	}

	proxyController := e.Group("/proxy")
	{
		proxyController.Any("/:port/*", proxy.ProxyHandler)
	}

	go portDetector.Start(context.Background())

	addr := fmt.Sprintf(":%d", config.TOOLBOX_API_PORT)

	// Print to stdout so the executor can know that the node is ready
	fmt.Println("Starting toolbox server on port", config.TOOLBOX_API_PORT)

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}

	e.Listener = listener
	return e.Start("")
}
