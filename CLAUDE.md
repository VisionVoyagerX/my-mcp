# CLAUDE.md

## Merge strategy

When a feature branch is complete and ready to land on `main`, always **squash merge** it — flatten all commits from the branch into a single commit on `main`. Do not use a merge commit or rebase-and-replay-individual-commits. Keeps `main` history at one clean commit per feature/PR.
