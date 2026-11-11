---
title: React hooks checker
description: Finds React hook mistakes like missing dependencies, stale closures and effects that loop.
author: marco
stack: React
tags: [react, hooks, bugs]
stars: 16
---
# React hooks checker

Finds React hook mistakes like missing dependencies, stale closures and effects that loop.

## When to use

Use this skill when a React component re-renders too often or shows stale values.

## Steps

1. Check every effect lists the values it reads in its dependencies.
2. Find effects that set state they also depend on, causing loops.
3. Find event handlers that capture stale state in closures.
4. Replace effects that only derive data with plain calculations.
5. Check hooks aren't called inside conditions or loops.

## Output

A list of issues per component, each with the fix.
