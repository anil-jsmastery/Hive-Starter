---
title: Jest test writer
description: Writes Jest unit tests for a function, covering edge cases before the happy path.
author: sam
stack: Node.js
tags: [testing, jest, javascript]
stars: 29
---
# Jest test writer

Writes Jest unit tests for a function, covering edge cases before the happy path.

## When to use

Use this skill when a JavaScript or TypeScript function has no tests.

## Steps

1. Read the function and list what it promises: inputs, outputs and thrown errors.
2. Write edge-case tests first: empty values, boundaries and invalid input.
3. Then write the happy path, with one assertion per behaviour.
4. Mock only the network and clock, never the code under test.
5. Give each test a name that reads like a sentence.

## Output

A test file next to the source file, ready to run with jest.
