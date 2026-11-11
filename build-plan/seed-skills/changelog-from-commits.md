---
title: Changelog from commits
description: Writes a user-facing changelog from the commits since the last release tag.
author: sam
stack: Any
tags: [git, release]
stars: 15
---
# Changelog from commits

Writes a user-facing changelog from the commits since the last release tag.

## When to use

Use this skill when preparing release notes from git history.

## Steps

1. Run git log from the previous tag to HEAD and group commits by type.
2. Drop internal noise such as formatting, CI tweaks and merge commits.
3. Rewrite each remaining change in plain words a user understands.
4. Put breaking changes first, with what users must do to upgrade.
5. Link each entry to its pull request when one exists.

## Output

A changelog section with Breaking, Added, Fixed and Changed headings.
