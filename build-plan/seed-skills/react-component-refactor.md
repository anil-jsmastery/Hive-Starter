---
title: React component refactor
description: Splits an oversized React component into smaller ones without changing behaviour.
author: marco
stack: React
tags: [react, refactoring]
stars: 21
---
# React component refactor

Splits an oversized React component into smaller ones without changing behaviour.

## When to use

Use this skill when a React component is hundreds of lines long and hard to change.

## Steps

1. List the component's responsibilities: data, state, layout and events.
2. Extract pure presentational pieces first; they're the safest.
3. Move related state and handlers into a custom hook.
4. Keep props small and named for what they mean, not how they're used.
5. Check behaviour is unchanged after each extraction.

## Output

The refactored components and a short before-and-after map.
