---
title: Go error wrapping
description: Makes Go errors useful by wrapping them with context and checking them with errors.Is.
author: tom
stack: Go
tags: [go, errors]
stars: 14
---
# Go error wrapping

Makes Go errors useful by wrapping them with context and checking them with errors.Is.

## When to use

Use this skill when Go errors reach the logs without enough context to debug.

## Steps

1. Find errors returned without context and wrap them with fmt.Errorf and %w.
2. Add the operation and key identifiers to each wrap, not the whole object.
3. Replace string comparisons on errors with errors.Is or errors.As.
4. Define sentinel errors for conditions callers need to handle.
5. Log each error once, at the top of the call chain.

## Output

A diff-style list of changes with before and after examples.
