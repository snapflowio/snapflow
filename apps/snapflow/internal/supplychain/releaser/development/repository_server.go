// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package development

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	maximumMetadataBytes = 8 * 1024 * 1024
	maximumTargetBytes   = 64 * 1024
	maximumAssetBytes    = 1024 * 1024 * 1024
	readHeaderTimeout    = 5 * time.Second
	idleTimeout          = 30 * time.Second
	shutdownTimeout      = 5 * time.Second
	listenNetwork        = "tcp"
	loopbackAddress      = "127.0.0.1:0"
	metadataPrefix       = "metadata/"
	targetsPrefix        = "targets/"
	assetsPrefix         = assetsDirectoryName + "/"
)

type repositoryServer struct {
	origin    string
	server    *http.Server
	listener  net.Listener
	root      *os.Root
	done      chan error
	closeOnce sync.Once
	closeErr  error
}

func startRepositoryServer(ctx context.Context, repositoryRoot string) (*repositoryServer, error) {
	root, err := validateRoot(repositoryRoot)
	if err != nil {
		return nil, err
	}
	fileRoot, err := os.OpenRoot(root)
	if err != nil {
		return nil, fmt.Errorf("open local repository root: %w", err)
	}
	listener, err := (&net.ListenConfig{}).Listen(ctx, listenNetwork, loopbackAddress)
	if err != nil {
		return nil, errors.Join(fmt.Errorf("bind local release repository: %w", err), fileRoot.Close())
	}
	address, ok := listener.Addr().(*net.TCPAddr)
	if !ok || !address.IP.IsLoopback() {
		closeErr := listener.Close()
		return nil, errors.Join(
			errors.New("local release repository did not bind to loopback"),
			closeErr,
			fileRoot.Close(),
		)
	}
	server := &repositoryServer{
		origin: "http://" + address.String(), listener: listener, root: fileRoot, done: make(chan error, 1),
	}
	server.server = &http.Server{
		Handler: repositoryHandler{root: fileRoot}, ReadHeaderTimeout: readHeaderTimeout,
		IdleTimeout: idleTimeout, MaxHeaderBytes: http.DefaultMaxHeaderBytes,
	}
	go func() {
		serveErr := server.server.Serve(listener)
		if errors.Is(serveErr, http.ErrServerClosed) {
			serveErr = nil
		}
		server.done <- serveErr
	}()
	return server, nil
}

func (server *repositoryServer) Origin() string { return server.origin }

func (server *repositoryServer) Close(ctx context.Context) error {
	server.closeOnce.Do(func() {
		shutdownContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
		defer cancel()
		shutdownErr := server.server.Shutdown(shutdownContext)
		serveErr := <-server.done
		server.closeErr = errors.Join(shutdownErr, serveErr, server.root.Close())
	})
	return server.closeErr
}

type repositoryHandler struct{ root *os.Root }

func (handler repositoryHandler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		response.Header().Set("Allow", http.MethodGet+", "+http.MethodHead)
		http.Error(response, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	relative, maximum, found := servedPath(request.URL)
	if !found {
		http.NotFound(response, request)
		return
	}
	file, err := handler.root.Open(filepath.FromSlash(relative))
	if err != nil {
		http.NotFound(response, request)
		return
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			panic(http.ErrAbortHandler)
		}
	}()
	serveFile(response, request, file, maximum)
}

func servedPath(requested *url.URL) (string, int64, bool) {
	if requested.RawQuery != "" || requested.Fragment != "" || strings.Contains(requested.Path, "\\") {
		return "", 0, false
	}
	clean := path.Clean(requested.Path)
	if clean != requested.Path || clean == "/" {
		return "", 0, false
	}
	relative := strings.TrimPrefix(clean, "/")
	switch {
	case strings.HasPrefix(relative, metadataPrefix):
		return relative, maximumMetadataBytes, true
	case strings.HasPrefix(relative, targetsPrefix):
		return relative, maximumTargetBytes, true
	case strings.HasPrefix(relative, assetsPrefix):
		return relative, maximumAssetBytes, true
	default:
		return "", 0, false
	}
}

func serveFile(response http.ResponseWriter, request *http.Request, file *os.File, maximum int64) {
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() <= 0 || info.Size() > maximum {
		http.NotFound(response, request)
		return
	}
	response.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	response.Header().Set("Content-Type", "application/octet-stream")
	if request.Method == http.MethodHead {
		response.WriteHeader(http.StatusOK)
		return
	}
	if _, err := io.CopyN(response, file, info.Size()); err != nil {
		panic(http.ErrAbortHandler)
	}
}

func validateRoot(value string) (string, error) {
	root := filepath.Clean(strings.TrimSpace(value))
	if !filepath.IsAbs(root) {
		return "", errors.New("local repository root must be absolute")
	}
	info, err := os.Stat(root)
	if err != nil {
		return "", fmt.Errorf("inspect local repository root: %w", err)
	}
	if !info.IsDir() {
		return "", errors.New("local repository root must be a directory")
	}
	return root, nil
}
