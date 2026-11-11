---
title: Code review buddy
description: Reviews a pull request for bugs, naming, tests and edge cases, then summarizes the risk.
author: aisha
stack: Any
tags: [review, quality]
stars: 47
---
# Code review buddy

Reviews a pull request for bugs, naming, tests and edge cases, then summarizes the risk.

## When to use

Use this skill when reviewing a pull request before it's merged.

## Steps

1. Read the description first and state what the change is supposed to do.
2. Check the logic for off-by-one errors, null handling and unhandled promise rejections.
3. Check that names say what things are and that functions do one job.
4. Check that tests cover the new behaviour and at least one edge case.
5. Separate must-fix issues from suggestions, and keep each comment specific.

## Output

A review with a one-line verdict, must-fix items, suggestions and open questions.
