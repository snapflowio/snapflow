// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	maximumReferenceBytes = 512
	maximumRequestBytes   = 64 << 10
	connectionTimeout     = 30 * time.Second
	directoryMode         = 0o700
)

type BuildLogStore struct {
	root string
}

func NewBuildLogStore(runtimeDataDirectory string) (*BuildLogStore, error) {
	root := filepath.Join(strings.TrimSpace(runtimeDataDirectory), "build-logs")
	if !filepath.IsAbs(root) {
		return nil, errors.New("build log directory must be absolute")
	}
	if err := os.MkdirAll(root, directoryMode); err != nil {
		return nil, fmt.Errorf("create build log directory: %w", err)
	}
	return &BuildLogStore{root: root}, nil
}

func (store *BuildLogStore) Path(reference string) (string, error) {
	trimmed := strings.TrimSpace(reference)
	if trimmed == "" || len(trimmed) > maximumReferenceBytes {
		return "", errors.New("build log reference is invalid")
	}
	digest := sha256.Sum256([]byte(trimmed))
	return filepath.Join(store.root, hex.EncodeToString(digest[:])+".log"), nil
}

func (store *BuildLogStore) DialBuildLog(
	ctx context.Context,
	reference string,
) (net.Conn, error) {
	path, err := store.Path(reference)
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("open build log: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("build log is not a regular file")
	}
	client, server := net.Pipe()
	go serveConnection(ctx, server, path, info.Size())
	return client, nil
}

func serveConnection(ctx context.Context, connection net.Conn, path string, size int64) {
	defer closeConnection(connection)
	stopCancellation := context.AfterFunc(ctx, func() { closeConnection(connection) })
	defer stopCancellation()
	if err := connection.SetDeadline(time.Now().Add(connectionTimeout)); err != nil {
		return
	}
	method, status := readBuildLogRequest(connection)
	if status != http.StatusOK {
		writeErrorResponse(connection, status)
		return
	}
	file, err := os.Open(path)
	if err != nil {
		writeErrorResponse(connection, http.StatusNotFound)
		return
	}
	defer func() {
		if err := file.Close(); err != nil {
			return
		}
	}()
	body := io.ReadCloser(file)
	if method == http.MethodHead {
		body = http.NoBody
	}
	response := http.Response{
		StatusCode:    http.StatusOK,
		Status:        http.StatusText(http.StatusOK),
		ProtoMajor:    1,
		ProtoMinor:    1,
		ContentLength: size,
		Body:          body,
		Close:         true,
		Header: http.Header{
			"Cache-Control":          {"no-store"},
			"Content-Type":           {"text/plain; charset=utf-8"},
			"X-Content-Type-Options": {"nosniff"},
		},
	}
	if err := response.Write(connection); err != nil {
		return
	}
}

func readBuildLogRequest(connection net.Conn) (string, int) {
	request, err := http.ReadRequest(
		bufio.NewReader(io.LimitReader(connection, maximumRequestBytes)),
	)
	if err != nil {
		return "", http.StatusBadRequest
	}
	if request.Body != nil {
		if err := request.Body.Close(); err != nil {
			return "", http.StatusBadRequest
		}
	}
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		return "", http.StatusMethodNotAllowed
	}
	return request.Method, http.StatusOK
}

func closeConnection(connection net.Conn) {
	if err := connection.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		return
	}
}

func writeErrorResponse(connection net.Conn, status int) {
	body := http.StatusText(status) + "\n"
	response := http.Response{
		StatusCode:    status,
		Status:        http.StatusText(status),
		ProtoMajor:    1,
		ProtoMinor:    1,
		ContentLength: int64(len(body)),
		Body:          io.NopCloser(strings.NewReader(body)),
		Close:         true,
		Header: http.Header{
			"Cache-Control":          {"no-store"},
			"Content-Type":           {"text/plain; charset=utf-8"},
			"X-Content-Type-Options": {"nosniff"},
		},
	}
	if err := response.Write(connection); err != nil {
		return
	}
}
