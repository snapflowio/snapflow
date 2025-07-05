package git

import (
	"fmt"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

func (s *Service) Checkout(branch string) error {
	r, err := git.PlainOpen(s.ProjectDir)
	if err != nil {
		return fmt.Errorf("failed to open repository: %w", err)
	}

	w, err := r.Worktree()
	if err != nil {
		return fmt.Errorf("failed to get worktree: %w", err)
	}

	err = w.Checkout(&git.CheckoutOptions{
		Branch: plumbing.NewBranchReferenceName(branch),
	})

	if err != nil {
		err = w.Checkout(&git.CheckoutOptions{
			Hash: plumbing.NewHash(branch),
		})

		if err != nil {
			return fmt.Errorf("failed to checkout branch or commit '%s': %w", branch, err)
		}
	}

	return nil
}
