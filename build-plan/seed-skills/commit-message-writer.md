---
title: Commit message writer
description: Writes conventional commit messages from a staged diff, with a clear subject and body.
author: sam
stack: Any
tags: [git, writing]
stars: 52
---
# Commit message writer

Writes conventional commit messages from a staged diff, with a clear subject and body.

## When to use

Use this skill when committing changes and you want a clean, consistent history.

## Steps

1. Read the staged diff with git diff --cached.
2. Pick the type: feat, fix, refactor, docs, test or chore.
3. Write a subject under 60 characters in the imperative mood.
4. Add a body only when the reason for the change isn't obvious from the diff.
5. Mention breaking changes in a BREAKING CHANGE footer.

## Output

One commit message, ready to paste into git commit.
