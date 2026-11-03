// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package installscript

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

const (
	installerPath     = "../../packaging/install.sh"
	installerShell    = "sh"
	latestVersion     = "1.2.3"
	olderVersion      = "1.1.0"
	exitUsage         = 2
	exitUnsupported   = 3
	exitVerify        = 65
	exitDownload      = 69
	fileMode          = 0o644
	executableMode    = 0o755
	setupNextStep     = "Next: sudo snapflow setup\n"
	betaSetupNextStep = "Next: sudo snapflow setup --channel beta\n"
	installStep       = "install -m 0755 -o 0 -g 0 "
	moveStep          = "mv -f /usr/local/bin/.snapflow.install /usr/local/bin/snapflow"
	signerIdentity    = `^https://github\.com/snapflowio/snapflow/\.github/workflows/release\.yml@refs/heads/main$`
	fakeCosign        = "#!/bin/sh\nprintf '%s\\n' \"$@\" >>\"$FAKE_COSIGN_LOG\"\nexit \"${FAKE_COSIGN_EXIT:-0}\"\n"
)

type release struct {
	files map[string][]byte
}

type fakeReleases struct {
	latest   string
	releases map[string]release
}

type installerOptions struct {
	arch       string
	kvm        bool
	systemd    bool
	cosignExit string
	env        []string
	arguments  []string
	releases   fakeReleases
}

type installerRun struct {
	stdout    string
	stderr    string
	code      int
	cosignLog string
}

func cliArchive(t *testing.T, binary string) []byte {
	t.Helper()
	var buffer bytes.Buffer
	compressed := gzip.NewWriter(&buffer)
	archive := tar.NewWriter(compressed)
	for _, entry := range []struct {
		name    string
		mode    int64
		content string
	}{
		{name: "THIRD_PARTY_NOTICES.md", mode: fileMode, content: "notices\n"},
		{name: "snapflow", mode: executableMode, content: binary},
	} {
		header := &tar.Header{Name: entry.name, Mode: entry.mode, Size: int64(len(entry.content)), Typeflag: tar.TypeReg}
		if err := archive.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if _, err := archive.Write([]byte(entry.content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
	if err := compressed.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func newRelease(t *testing.T, version string, corrupt bool) release {
	t.Helper()
	files := map[string][]byte{"SHA256SUMS.sigstore.json": []byte("{}\n")}
	var sums strings.Builder
	for _, arch := range []string{"amd64", "arm64"} {
		name := fmt.Sprintf("snapflow-%s-linux-%s.tar.gz", version, arch)
		content := cliArchive(t, "#!/bin/sh\necho snapflow "+version+" "+arch+"\n")
		digest := sha256.Sum256(content)
		files[name] = content
		if corrupt {
			files[name] = append([]byte{0}, content...)
		}
		fmt.Fprintf(&sums, "%s  %s\n", hex.EncodeToString(digest[:]), name)
	}
	files["SHA256SUMS"] = []byte(sums.String())
	return release{files: files}
}

func defaultReleases(t *testing.T) fakeReleases {
	t.Helper()
	return fakeReleases{
		latest: latestVersion,
		releases: map[string]release{
			latestVersion: newRelease(t, latestVersion, false),
			olderVersion:  newRelease(t, olderVersion, false),
		},
	}
}

func serve(t *testing.T, releases fakeReleases) string {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/releases/latest", func(writer http.ResponseWriter, request *http.Request) {
		if releases.latest == "" {
			http.Redirect(writer, request, "/releases", http.StatusFound)
			return
		}
		http.Redirect(writer, request, "/releases/tag/v"+releases.latest, http.StatusFound)
	})
	mux.HandleFunc("/releases", func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/releases/tag/{tag}", func(writer http.ResponseWriter, request *http.Request) {
		if _, ok := releases.releases[strings.TrimPrefix(request.PathValue("tag"), "v")]; !ok {
			http.NotFound(writer, request)
			return
		}
		writer.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/releases/download/{tag}/{file}", func(writer http.ResponseWriter, request *http.Request) {
		published, ok := releases.releases[strings.TrimPrefix(request.PathValue("tag"), "v")]
		if !ok || !strings.HasPrefix(request.PathValue("tag"), "v") {
			http.NotFound(writer, request)
			return
		}
		content, ok := published.files[request.PathValue("file")]
		if !ok {
			http.NotFound(writer, request)
			return
		}
		_, _ = writer.Write(content)
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server.URL + "/releases"
}

func runInstaller(t *testing.T, options installerOptions) installerRun {
	t.Helper()
	if _, err := exec.LookPath("curl"); err != nil {
		t.Skip("curl is required to exercise the installer")
	}
	directory := t.TempDir()
	kvmPath := filepath.Join(directory, "kvm")
	if options.kvm {
		if err := os.WriteFile(kvmPath, nil, fileMode); err != nil {
			t.Fatal(err)
		}
	}
	systemdPath := filepath.Join(directory, "systemd")
	if options.systemd {
		if err := os.Mkdir(systemdPath, executableMode); err != nil {
			t.Fatal(err)
		}
	}
	binPath := filepath.Join(directory, "bin")
	if err := os.Mkdir(binPath, executableMode); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(binPath, "cosign"), []byte(fakeCosign), executableMode); err != nil {
		t.Fatal(err)
	}
	cosignLog := filepath.Join(directory, "cosign.log")
	releases := options.releases
	if releases.releases == nil {
		releases = defaultReleases(t)
	}
	command := exec.CommandContext(t.Context(), installerShell, append([]string{installerPath}, options.arguments...)...)
	command.Env = append(os.Environ(),
		"PATH="+binPath+string(os.PathListSeparator)+os.Getenv("PATH"),
		"SNAPFLOW_INSTALL_BASE_URL="+serve(t, releases),
		"SNAPFLOW_INSTALL_ARCH="+options.arch,
		"SNAPFLOW_INSTALL_KVM_DEVICE="+kvmPath,
		"SNAPFLOW_INSTALL_SYSTEMD_DIRECTORY="+systemdPath,
		"SNAPFLOW_VERSION=",
		"SNAPFLOW_CHANNEL=",
		"FAKE_COSIGN_LOG="+cosignLog,
		"FAKE_COSIGN_EXIT="+options.cosignExit,
		"NO_COLOR=1",
	)
	command.Env = append(command.Env, options.env...)
	var stdout, stderr bytes.Buffer
	command.Stdout, command.Stderr = &stdout, &stderr
	run := installerRun{}
	if err := command.Run(); err != nil {
		var exited *exec.ExitError
		if !errors.As(err, &exited) {
			t.Fatalf("run installer: %v", err)
		}
		run.code = exited.ExitCode()
	}
	run.stdout, run.stderr = stdout.String(), stderr.String()
	if log, err := os.ReadFile(cosignLog); err == nil {
		run.cosignLog = string(log)
	}
	return run
}

func TestInstallerDryRunVerifiesAndInstallsTheRequestedRelease(t *testing.T) {
	cases := []struct {
		name      string
		arch      string
		env       []string
		arguments []string
		want      []string
	}{
		{
			name: "latest stable on amd64", arch: "x86_64", arguments: []string{"--dry-run"},
			want: []string{"stable channel", "Downloaded Snapflow " + latestVersion + " for amd64", "Checksum verified", "Signature verified with cosign", installStep, moveStep, setupNextStep},
		},
		{
			name: "pinned version on arm64", arch: "aarch64", arguments: []string{"--dry-run", "--version", olderVersion},
			want: []string{"Downloaded Snapflow " + olderVersion + " for arm64", "Checksum verified", moveStep, setupNextStep},
		},
		{
			name: "version and channel from the environment", arch: "arm64", arguments: []string{"--dry-run"},
			env:  []string{"SNAPFLOW_VERSION=v" + olderVersion, "SNAPFLOW_CHANNEL=beta"},
			want: []string{"beta channel", "Downloaded Snapflow " + olderVersion + " for arm64", moveStep, betaSetupNextStep},
		},
		{
			name: "beta channel flag", arch: "amd64", arguments: []string{"--dry-run", "--channel=beta"},
			want: []string{"beta channel", "Downloaded Snapflow " + latestVersion + " for amd64", betaSetupNextStep},
		},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			run := runInstaller(t, installerOptions{arch: testCase.arch, kvm: true, systemd: true, env: testCase.env, arguments: testCase.arguments})
			if run.code != 0 {
				t.Fatalf("installer exited %d: %s", run.code, run.stderr)
			}
			for _, want := range testCase.want {
				if !strings.Contains(run.stdout, want) {
					t.Errorf("dry run does not contain %q:\n%s", want, run.stdout)
				}
			}
			for _, want := range []string{"verify-blob", "--certificate-identity-regexp\n" + signerIdentity + "\n", "--certificate-oidc-issuer\nhttps://token.actions.githubusercontent.com\n"} {
				if !strings.Contains(run.cosignLog, want) {
					t.Errorf("cosign was not called with %q:\n%s", want, run.cosignLog)
				}
			}
		})
	}
}

func TestInstallerRefusesUnverifiedOrMissingReleases(t *testing.T) {
	corrupt := fakeReleases{latest: latestVersion, releases: map[string]release{latestVersion: newRelease(t, latestVersion, true)}}
	cases := []struct {
		name       string
		releases   fakeReleases
		cosignExit string
		arguments  []string
		code       int
		want       string
	}{
		{name: "checksum mismatch", releases: corrupt, code: exitVerify, want: "checksum mismatch for snapflow-" + latestVersion + "-linux-amd64.tar.gz"},
		{name: "bad signature", cosignExit: "1", code: exitVerify, want: "the SHA256SUMS signature does not verify"},
		{name: "unknown version", arguments: []string{"--version", "9.9.9"}, code: exitDownload, want: "cannot download"},
		{name: "no stable release yet", releases: fakeReleases{releases: map[string]release{}}, code: exitDownload, want: "no stable Snapflow release is published yet"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			run := runInstaller(t, installerOptions{
				arch: "x86_64", kvm: true, systemd: true, releases: testCase.releases, cosignExit: testCase.cosignExit,
				arguments: append([]string{"--dry-run"}, testCase.arguments...),
			})
			if run.code != testCase.code {
				t.Fatalf("installer exited %d, want %d: %s", run.code, testCase.code, run.stderr)
			}
			if !strings.Contains(run.stderr, testCase.want) {
				t.Fatalf("stderr %q does not contain %q", run.stderr, testCase.want)
			}
			if strings.Contains(run.stdout, installStep) {
				t.Fatalf("installer installed an unverified binary:\n%s", run.stdout)
			}
		})
	}
}

func TestInstallerFailsClosedWithActionableMessages(t *testing.T) {
	cases := []struct {
		name      string
		arch      string
		kvm       bool
		systemd   bool
		arguments []string
		code      int
		want      string
	}{
		{name: "missing kvm", arch: "x86_64", systemd: true, code: exitUnsupported, want: "enable hardware virtualization"},
		{name: "missing systemd", arch: "x86_64", kvm: true, code: exitUnsupported, want: "systemd is not running"},
		{name: "unsupported architecture", arch: "riscv64", kvm: true, systemd: true, code: exitUnsupported, want: "unsupported CPU architecture: riscv64"},
		{name: "unknown option", arch: "x86_64", kvm: true, systemd: true, arguments: []string{"--force"}, code: exitUsage, want: "unknown option: --force"},
		{name: "unknown channel", arch: "x86_64", kvm: true, systemd: true, arguments: []string{"--channel", "nightly"}, code: exitUsage, want: "unknown channel: nightly"},
		{name: "invalid version", arch: "x86_64", kvm: true, systemd: true, arguments: []string{"--version", "1.2"}, code: exitUsage, want: "invalid version: 1.2"},
		{name: "missing version value", arch: "x86_64", kvm: true, systemd: true, arguments: []string{"--version"}, code: exitUsage, want: "--version needs a value"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			run := runInstaller(t, installerOptions{
				arch: testCase.arch, kvm: testCase.kvm, systemd: testCase.systemd,
				arguments: append([]string{"--dry-run"}, testCase.arguments...),
			})
			if run.code != testCase.code {
				t.Fatalf("installer exited %d, want %d: %s", run.code, testCase.code, run.stderr)
			}
			if !strings.Contains(run.stderr, testCase.want) {
				t.Fatalf("stderr %q does not contain %q", run.stderr, testCase.want)
			}
			if strings.Contains(run.stdout, "Downloaded") || run.cosignLog != "" {
				t.Fatalf("installer downloaded a release before failing:\n%s", run.stdout)
			}
		})
	}
}
