---
title: Python type hints
description: Adds type hints to a Python module and fixes the errors mypy reports.
author: lena
stack: Python
tags: [python, typing, quality]
stars: 19
---
# Python type hints

Adds type hints to a Python module and fixes the errors mypy reports.

## When to use

Use this skill when a Python codebase has no types or mypy fails.

## Steps

1. Add hints to function signatures first, starting with public functions.
2. Use precise types: list of str, dict of str to int, Optional only when None is valid.
3. Run mypy and fix errors from the bottom of the call graph up.
4. Use TypedDict or dataclasses for dictionaries with a fixed shape.
5. Avoid Any except at clearly marked boundaries.

## Output

The typed module and a short list of decisions made along the way.
