---
title: Go table-driven tests
description: Writes table-driven tests for a Go function, covering edge cases and errors.
author: tom
stack: Go
tags: [go, testing]
stars: 12
---
# Go table-driven tests

Writes table-driven tests for a Go function, covering edge cases and errors.

## When to use

Use this skill when adding tests to a Go function or refactoring existing ones.

## Steps

1. Read the function and list its inputs, outputs and error cases.
2. Write a test table with a name, inputs and the expected result per case.
3. Include empty input, boundary values and at least one error case.
4. Run each case with t.Run so failures name the case.
5. Keep helpers small and mark them with t.Helper.

## Output

A _test.go file ready to run with go test.
