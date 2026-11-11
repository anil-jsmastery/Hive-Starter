---
title: Environment variable audit
description: Finds every environment variable an app reads and checks it's documented, typed and not leaked.
author: nora
stack: Any
tags: [security, config]
stars: 13
---
# Environment variable audit

Finds every environment variable an app reads and checks it's documented, typed and not leaked.

## When to use

Use this skill when before a deploy, or when onboarding someone to a project.

## Steps

1. Search the code for every environment variable it reads.
2. Compare the list with .env.example and flag anything missing or unused.
3. Flag secrets exposed to the browser through public prefixes.
4. Check that required variables fail loudly at startup when missing.
5. Suggest a single typed config module if variables are read all over the code.

## Output

A table of variables with where they're used, whether they're secret and what to fix.
