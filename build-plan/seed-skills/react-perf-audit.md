---
title: React performance audit
description: Finds unnecessary re-renders, heavy bundles and missing memoization in a React app.
author: marco
stack: React
tags: [react, performance]
stars: 38
---
# React performance audit

Finds unnecessary re-renders, heavy bundles and missing memoization in a React app.

## When to use

Use this skill when a React app feels slow or a page takes long to become interactive.

## Steps

1. Measure first: profile the slow interaction and note the components that re-render.
2. Find props that change identity on every render, such as inline objects and functions.
3. Memoize only the components the profile shows are expensive.
4. Check the bundle for large libraries that could be loaded lazily.
5. Re-measure and report the before and after numbers.

## Output

A short report with measurements, fixes made and their effect.
