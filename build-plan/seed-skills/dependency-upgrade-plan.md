---
title: Dependency upgrade plan
description: Plans a safe upgrade of outdated dependencies, ordered by risk, with what to test.
author: tom
stack: Any
tags: [dependencies, maintenance]
stars: 7
---
# Dependency upgrade plan

Plans a safe upgrade of outdated dependencies, ordered by risk, with what to test.

## When to use

Use this skill when a project has fallen behind on package versions.

## Steps

1. List outdated packages with their current and latest versions.
2. Group them: patch, minor, and major versions with breaking changes.
3. Read the changelog of every major upgrade and note what breaks.
4. Order the upgrades from lowest to highest risk, one pull request per group.
5. Name the tests or manual checks that prove each group works.

## Output

An ordered upgrade plan with risks and a test checklist per step.
