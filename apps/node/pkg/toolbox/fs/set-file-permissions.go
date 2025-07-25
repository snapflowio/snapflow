package fs

import (
	"fmt"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strconv"

	"github.com/labstack/echo/v4"
)

func SetFilePermissions(c echo.Context) error {
	path := c.QueryParam("path")
	ownerParam := c.QueryParam("owner")
	groupParam := c.QueryParam("group")
	mode := c.QueryParam("mode")

	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path is required")
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid path")
	}

	_, err = os.Stat(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		if os.IsPermission(err) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if mode != "" {
		modeNum, err := strconv.ParseUint(mode, 8, 32)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid mode format")
		}

		if err := os.Chmod(absPath, os.FileMode(modeNum)); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to change mode: %v", err))
		}
	}

	if ownerParam != "" || groupParam != "" {
		uid := -1
		gid := -1

		// resolve owner
		if ownerParam != "" {
			// first try as numeric UID
			if uidNum, err := strconv.Atoi(ownerParam); err == nil {
				uid = uidNum
			} else {
				// try as username
				if u, err := user.Lookup(ownerParam); err == nil {
					if uid, err = strconv.Atoi(u.Uid); err != nil {
						return echo.NewHTTPError(http.StatusBadRequest, "invalid user ID")
					}
				} else {
					return echo.NewHTTPError(http.StatusBadRequest, "user not found")
				}
			}
		}

		// resolve group
		if groupParam != "" {
			// first try as numeric GID
			if gidNum, err := strconv.Atoi(groupParam); err == nil {
				gid = gidNum
			} else {
				// try as group name
				if g, err := user.LookupGroup(groupParam); err == nil {
					if gid, err = strconv.Atoi(g.Gid); err != nil {
						return echo.NewHTTPError(http.StatusBadRequest, "invalid group ID")
					}
				} else {
					return echo.NewHTTPError(http.StatusBadRequest, "group not found")
				}
			}
		}

		if err := os.Chown(absPath, uid, gid); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to change ownership: %v", err))
		}
	}

	return c.NoContent(http.StatusOK)
}
