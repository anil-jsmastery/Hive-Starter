---
title: Tailwind class cleanup
description: Cleans up long Tailwind class lists into consistent, readable components.
author: marco
stack: React
tags: [tailwind, css, refactoring]
stars: 20
---
# Tailwind class cleanup

Cleans up long Tailwind class lists into consistent, readable components.

## When to use

Use this skill when Tailwind classes are repeated and inconsistent across components.

## Steps

1. Find class lists repeated in three or more places.
2. Extract them into a component or a variant, not a global stylesheet.
3. Replace one-off colours and sizes with the design tokens.
4. Order classes consistently: layout, spacing, typography, colour, state.
5. Check the pages look the same before and after.

## Output

The cleaned components and a list of tokens used.
