# Release trust root

Release builds embed `root.json` from this directory as the TUF bootstrap root.
It is the public `metadata/1.root.json` produced by `snapflow-release tuf init --policy production`;
see docs/releases.md.
