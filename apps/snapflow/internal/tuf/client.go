// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	tufconfig "github.com/theupdateframework/go-tuf/v2/metadata/config"
	"github.com/theupdateframework/go-tuf/v2/metadata/updater"
)

const (
	DefaultRepositoryOrigin = "https://releases.snapflow.io"
	DefaultAssetOrigin      = "https://github.com/snapflowio/snapflow/releases/download/"
	maximumRootBytes        = 512 * 1024
	minimumReleaseHeadroom  = 10 * 1024 * 1024 * 1024
	metadataRequestTimeout  = 30 * time.Second
	maximumRedirects        = 10
	downloadDirectoryMode   = 0o700
	downloadPattern         = ".snapflow-runtime-*.tar.zst"
	downloadsDirectoryName  = "downloads"
)

type TransportPolicy string

const (
	HTTPSOnlyTransport    TransportPolicy = "https-only"
	LoopbackHTTPTransport TransportPolicy = "loopback-http"
)

type ClientConfig struct {
	Origin        string
	AssetOrigin   string
	BootstrapRoot []byte
	StateRoot     string
	HTTPClient    *http.Client
	Transport     TransportPolicy
}

type Client struct {
	updater     *updater.Updater
	assetOrigin *url.URL
	assetClient *http.Client
	downloads   string
	headroom    uint64
}

func NewClient(cfg ClientConfig) (*Client, error) {
	origin, err := parseOrigin(cfg.Origin, cfg.Transport)
	if err != nil {
		return nil, err
	}
	assetOrigin, err := parseAssetOrigin(cfg.AssetOrigin, cfg.Transport)
	if err != nil {
		return nil, err
	}
	root, err := trustedRoot(cfg.BootstrapRoot, cfg.StateRoot)
	if err != nil {
		return nil, err
	}
	metadataURL, err := url.JoinPath(origin.String(), metadataDirectoryName)
	if err != nil {
		return nil, fmt.Errorf("create metadata URL: %w", err)
	}
	targetsURL, err := url.JoinPath(origin.String(), targetsDirectoryName)
	if err != nil {
		return nil, fmt.Errorf("create targets URL: %w", err)
	}
	configuration, err := tufconfig.New(metadataURL, root)
	if err != nil {
		return nil, fmt.Errorf("configure TUF updater: %w", err)
	}
	configuration.LocalMetadataDir = filepath.Join(cfg.StateRoot, metadataDirectoryName)
	configuration.LocalTargetsDir = filepath.Join(cfg.StateRoot, targetsDirectoryName)
	configuration.RemoteTargetsURL = targetsURL
	configuration.PrefixTargetsWithHash = true
	metadataClient, err := repositoryHTTPClient(cfg.HTTPClient, cfg.Transport, sameOriginRedirects(origin))
	if err != nil {
		return nil, err
	}
	if err := configuration.SetDefaultFetcherHTTPClient(metadataClient); err != nil {
		return nil, fmt.Errorf("configure TUF metadata transport: %w", err)
	}
	assetClient, err := repositoryHTTPClient(cfg.HTTPClient, cfg.Transport, assetRedirects(assetOrigin, cfg.Transport))
	if err != nil {
		return nil, err
	}
	assetClient.Timeout = 0
	clientUpdater, err := updater.New(configuration)
	if err != nil {
		return nil, fmt.Errorf("initialize TUF updater: %w", err)
	}
	return &Client{
		updater: clientUpdater, assetOrigin: assetOrigin, assetClient: assetClient,
		downloads: filepath.Join(cfg.StateRoot, downloadsDirectoryName), headroom: minimumReleaseHeadroom,
	}, nil
}

func (client *Client) Resolve(channel Channel) (ChannelRelease, error) {
	if err := client.updater.Refresh(); err != nil {
		return ChannelRelease{}, fmt.Errorf("refresh TUF metadata: %w", err)
	}
	info, err := client.updater.GetTargetInfo(channelPath(channel, runtime.GOARCH))
	if err != nil {
		return ChannelRelease{}, fmt.Errorf("resolve the %s channel: %w", channel, err)
	}
	if info.Length <= 0 || info.Length > maximumChannelBytes {
		return ChannelRelease{}, errors.New("invalid TUF channel target length")
	}
	_, encoded, err := client.updater.DownloadTarget(info, "", "")
	if err != nil {
		return ChannelRelease{}, fmt.Errorf("download the %s channel: %w", channel, err)
	}
	return decodeChannelRelease(encoded, channel, runtime.GOARCH)
}

func (client *Client) Download(ctx context.Context, selected ChannelRelease) (string, error) {
	if err := selected.validate(selected.Channel, runtime.GOARCH); err != nil {
		return "", err
	}
	if err := os.MkdirAll(client.downloads, downloadDirectoryMode); err != nil {
		return "", fmt.Errorf("create Snapflow release download directory: %w", err)
	}
	if err := requireAvailableStorage(client.downloads, uint64(selected.Length)+client.headroom); err != nil {
		return "", err
	}
	remoteURL, err := client.assetOrigin.Parse(selected.AssetPath())
	if err != nil {
		return "", fmt.Errorf("create Snapflow release URL: %w", err)
	}
	return client.fetch(ctx, remoteURL, selected.Length, selected.SHA256)
}

func (client *Client) fetch(ctx context.Context, remoteURL *url.URL, length int64, expectedDigest string) (filePath string, resultErr error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, remoteURL.String(), nil)
	if err != nil {
		return "", fmt.Errorf("create Snapflow release request: %w", err)
	}
	response, err := client.assetClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("download Snapflow release: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			resultErr = errors.Join(resultErr, err)
		}
	}()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download Snapflow release: HTTP %d", response.StatusCode)
	}
	if response.ContentLength > length {
		return "", errors.New("the Snapflow release response exceeds its signed length")
	}
	return client.store(response.Body, length, expectedDigest)
}

func (client *Client) store(body io.Reader, length int64, expectedDigest string) (string, error) {
	file, err := os.CreateTemp(client.downloads, downloadPattern)
	if err != nil {
		return "", fmt.Errorf("create Snapflow release download: %w", err)
	}
	err = writeVerified(file, body, length, expectedDigest)
	if err = errors.Join(err, file.Close()); err != nil {
		return "", errors.Join(err, os.Remove(file.Name()))
	}
	return file.Name(), nil
}

func writeVerified(file *os.File, body io.Reader, length int64, expectedDigest string) error {
	hash := sha256.New()
	written, err := io.Copy(io.MultiWriter(file, hash), io.LimitReader(body, length+1))
	if err != nil {
		return fmt.Errorf("write Snapflow release download: %w", err)
	}
	if written != length {
		return fmt.Errorf("the Snapflow release length %d does not match the signed length %d", written, length)
	}
	if sha256Digest(hash.Sum(nil)) != expectedDigest {
		return errors.New("the Snapflow release digest does not match the signed channel")
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync Snapflow release download: %w", err)
	}
	return nil
}

func parseOrigin(value string, policy TransportPolicy) (*url.URL, error) {
	origin, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return nil, fmt.Errorf("parse release repository origin: %w", err)
	}
	if origin.Host == "" || origin.User != nil || origin.Path != "" || origin.RawQuery != "" || origin.Fragment != "" {
		return nil, errors.New("release repository must be an absolute origin without credentials or a path")
	}
	switch policy {
	case HTTPSOnlyTransport:
		if origin.Scheme != "https" {
			return nil, errors.New("release repository must use HTTPS")
		}
	case LoopbackHTTPTransport:
		if origin.Scheme != "http" || !loopbackHost(origin.Hostname()) {
			return nil, errors.New("development release repository must use HTTP on a loopback host")
		}
	default:
		return nil, errors.New("release repository transport policy is required")
	}
	return origin, nil
}

func loopbackHost(host string) bool {
	if strings.EqualFold(strings.TrimSpace(host), "localhost") {
		return true
	}
	address := net.ParseIP(strings.TrimSpace(host))
	return address != nil && address.IsLoopback()
}

func parseAssetOrigin(value string, policy TransportPolicy) (*url.URL, error) {
	origin, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return nil, fmt.Errorf("parse release asset origin: %w", err)
	}
	if origin.Host == "" || origin.User != nil || !strings.HasSuffix(origin.Path, "/") ||
		origin.RawQuery != "" || origin.Fragment != "" {
		return nil, errors.New("release asset origin must be an absolute URL ending in a slash, without credentials")
	}
	if _, err := parseOrigin(origin.Scheme+"://"+origin.Host, policy); err != nil {
		return nil, fmt.Errorf("release asset origin: %w", err)
	}
	return origin, nil
}

func repositoryHTTPClient(
	configured *http.Client,
	policy TransportPolicy,
	redirects func(*http.Request, []*http.Request) error,
) (*http.Client, error) {
	client := &http.Client{Timeout: metadataRequestTimeout}
	if configured != nil {
		*client = *configured
		if client.Timeout == 0 {
			client.Timeout = metadataRequestTimeout
		}
	}
	if policy == LoopbackHTTPTransport {
		transport, err := loopbackTransport(client.Transport)
		if err != nil {
			return nil, err
		}
		client.Transport = transport
	}
	configuredRedirects := client.CheckRedirect
	client.CheckRedirect = func(request *http.Request, via []*http.Request) error {
		if len(via) >= maximumRedirects {
			return errors.New("release repository redirected too many times")
		}
		if err := redirects(request, via); err != nil {
			return err
		}
		if configuredRedirects != nil {
			return configuredRedirects(request, via)
		}
		return nil
	}
	return client, nil
}

func sameOriginRedirects(origin *url.URL) func(*http.Request, []*http.Request) error {
	return func(request *http.Request, _ []*http.Request) error {
		if request.URL.Scheme != origin.Scheme || !strings.EqualFold(request.URL.Host, origin.Host) {
			return errors.New("release repository redirect escaped its configured origin")
		}
		return nil
	}
}

func assetRedirects(origin *url.URL, policy TransportPolicy) func(*http.Request, []*http.Request) error {
	if policy == LoopbackHTTPTransport {
		return sameOriginRedirects(origin)
	}
	return func(request *http.Request, _ []*http.Request) error {
		if request.URL.Scheme != "https" {
			return errors.New("release asset redirect left HTTPS")
		}
		return nil
	}
}

func loopbackTransport(configured http.RoundTripper) (*http.Transport, error) {
	if configured == nil {
		configured = http.DefaultTransport
	}
	httpTransport, ok := configured.(*http.Transport)
	if !ok {
		return nil, errors.New("development repository requires an inspectable HTTP transport")
	}
	cloned := httpTransport.Clone()
	dial := cloned.DialContext
	if dial == nil {
		dial = (&net.Dialer{}).DialContext
	}
	cloned.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		connection, err := dial(ctx, network, address)
		if err != nil {
			return nil, err
		}
		remote, ok := connection.RemoteAddr().(*net.TCPAddr)
		if !ok || !remote.IP.IsLoopback() {
			closeErr := connection.Close()
			return nil, errors.Join(errors.New("development repository resolved outside loopback"), closeErr)
		}
		return connection, nil
	}
	return cloned, nil
}

func trustedRoot(bootstrap []byte, stateRoot string) ([]byte, error) {
	persisted := filepath.Join(stateRoot, metadataDirectoryName, rootFileName)
	encoded, err := os.ReadFile(persisted)
	switch {
	case errors.Is(err, os.ErrNotExist):
		encoded = bootstrap
	case err != nil:
		return nil, fmt.Errorf("read persisted TUF root: %w", err)
	}
	if len(encoded) == 0 || len(encoded) > maximumRootBytes {
		return nil, errors.New("trusted TUF root has an invalid length")
	}
	return encoded, nil
}
