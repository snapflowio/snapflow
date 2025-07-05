package git

import (
	"fmt"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/protocol/packp/capability"
	"github.com/go-git/go-git/v5/plumbing/transport"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/snapflow/node/pkg/provider"
)

func (s *Service) CloneRepository(repo *provider.GitRepository, auth *http.BasicAuth) error {
	cloneOptions := &git.CloneOptions{
		URL:             repo.Url,
		SingleBranch:    true,
		InsecureSkipTLS: true,
		Auth:            auth,
	}

	if s.LogWriter != nil {
		cloneOptions.Progress = s.LogWriter
	}

	transport.UnsupportedCapabilities = []capability.Capability{
		capability.ThinPack,
	}

	cloneOptions.ReferenceName = plumbing.ReferenceName("refs/heads/" + repo.Branch)

	_, err := git.PlainClone(s.ProjectDir, false, cloneOptions)
	if err != nil {
		return err
	}

	if repo.Target == provider.CloneTargetCommit {
		r, err := git.PlainOpen(s.ProjectDir)
		if err != nil {
			return err
		}

		w, err := r.Worktree()
		if err != nil {
			return err
		}

		err = w.Checkout(&git.CheckoutOptions{
			Hash: plumbing.NewHash(repo.Sha),
		})
		if err != nil {
			return err
		}
	}

	return err
}

func (s *Service) CloneRepositoryCmd(repo *provider.GitRepository, auth *http.BasicAuth) []string {
	cloneCmd := []string{"git", "clone", "--single-branch", "--branch", fmt.Sprintf("\"%s\"", repo.Branch)}
	cloneUrl := repo.Url

	if !strings.Contains(cloneUrl, "://") {
		cloneUrl = fmt.Sprintf("https://%s", cloneUrl)
	}

	if auth != nil {
		cloneUrl = fmt.Sprintf("%s://%s:%s@%s", strings.Split(cloneUrl, "://")[0], auth.Username, auth.Password, strings.SplitN(cloneUrl, "://", 2)[1])
	}

	cloneCmd = append(cloneCmd, cloneUrl, s.ProjectDir)

	if repo.Target == provider.CloneTargetCommit {
		cloneCmd = append(cloneCmd, "&&", "cd", s.ProjectDir)
		cloneCmd = append(cloneCmd, "&&", "git", "checkout", repo.Sha)
	}

	return cloneCmd
}
