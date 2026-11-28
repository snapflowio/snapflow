// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"fmt"
	"os"
	"os/exec"
	"slices"
	"strings"
	"syscall"

	mobyuser "github.com/moby/sys/user"
	"github.com/snapflowio/common-go/pkg/guestspec"
)

const (
	rootUserName = "root"
	rootHome     = "/root"
	fallbackHome = "/"
	passwdPath   = "/etc/passwd"
	groupPath    = "/etc/group"
	userSpecSep  = ":"
)

func identityEnvironment() []string {
	return []string{"HOME", "USER", "LOGNAME"}
}

type User struct {
	Name   string
	UID    uint32
	GID    uint32
	Groups []uint32
	Home   string
	Shell  string
}

func DefaultUser() (User, error) {
	return LookupUser(os.Getenv(guestspec.SandboxUserEnvironment))
}

func ResolveUser(override *string) (User, error) {
	if override != nil && strings.TrimSpace(*override) != "" {
		return LookupUser(*override)
	}
	return DefaultUser()
}

func LookupUser(spec string) (User, error) {
	spec = strings.TrimSpace(spec)
	if spec == "" {
		spec = rootUserName
	}
	resolved, err := mobyuser.GetExecUserPath(
		spec,
		&mobyuser.ExecUser{Uid: 0, Gid: 0, Home: rootHome},
		passwdPath,
		groupPath,
	)
	if err != nil {
		return User{}, fmt.Errorf("resolve sandbox user %q: %w", spec, err)
	}
	if resolved.Uid < 0 || resolved.Gid < 0 {
		return User{}, fmt.Errorf("sandbox user %q resolved to a negative user or group identifier", spec)
	}
	groups := make([]uint32, 0, len(resolved.Sgids))
	for _, groupID := range resolved.Sgids {
		if groupID < 0 {
			return User{}, fmt.Errorf("sandbox user %q resolved to a negative supplementary group identifier", spec)
		}
		if groupID != resolved.Gid {
			groups = append(groups, uint32(groupID))
		}
	}
	home := strings.TrimSpace(resolved.Home)
	if home == "" {
		home = fallbackHome
	}
	name, shell := passwdAccount(spec, resolved.Uid)
	return User{
		Name:   name,
		UID:    uint32(resolved.Uid),
		GID:    uint32(resolved.Gid),
		Groups: groups,
		Home:   home,
		Shell:  shell,
	}, nil
}

func passwdAccount(spec string, uid int) (string, string) {
	name, _, _ := strings.Cut(spec, userSpecSep)
	users, err := mobyuser.ParsePasswdFileFilter(passwdPath, func(entry mobyuser.User) bool {
		return entry.Uid == uid
	})
	if err != nil || len(users) == 0 {
		return name, ""
	}
	return users[0].Name, users[0].Shell
}

func (u User) IsRoot() bool {
	return u.UID == 0
}

func (u User) Environ(base []string) []string {
	identity := identityEnvironment()
	result := make([]string, 0, len(base)+len(identity))
	for _, entry := range base {
		key, _, _ := strings.Cut(entry, "=")
		if !slices.Contains(identity, key) {
			result = append(result, entry)
		}
	}
	return append(result, "HOME="+u.Home, "USER="+u.Name, "LOGNAME="+u.Name)
}

func (u User) Configure(cmd *exec.Cmd) {
	base := cmd.Env
	if base == nil {
		base = os.Environ()
	}
	cmd.Env = u.Environ(base)
	if u.IsRoot() {
		return
	}
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Credential = &syscall.Credential{Uid: u.UID, Gid: u.GID, Groups: u.Groups}
}
