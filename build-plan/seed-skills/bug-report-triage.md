---
title: Bug report triage
description: Turns a messy bug report into clear reproduction steps, severity and a likely cause.
author: aisha
stack: Any
tags: [bugs, triage]
stars: 8
---
# Bug report triage

Turns a messy bug report into clear reproduction steps, severity and a likely cause.

## When to use

Use this skill when a bug report is vague, emotional or missing steps.

## Steps

1. Restate the problem in one sentence: what happened versus what was expected.
2. Extract or ask for the exact steps, environment, version and frequency.
3. Assign a severity: blocker, major, minor or cosmetic, with one line of reasoning.
4. Search the codebase for the code path involved and name the most likely cause.
5. Suggest the smallest test that would reproduce it.

## Output

A triage note with summary, steps, severity, suspected cause and next action.
