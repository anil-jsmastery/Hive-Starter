---
title: Next.js caching guide
description: Explains what a Next.js page caches and fixes stale data and slow pages.
author: kenji
stack: Next.js
tags: [nextjs, caching, performance]
stars: 27
---
# Next.js caching guide

Explains what a Next.js page caches and fixes stale data and slow pages.

## When to use

Use this skill when a Next.js page shows stale data or is slower than expected.

## Steps

1. Identify whether the page renders statically, dynamically or on demand.
2. List every data fetch and how long its result is cached.
3. Find mutations that don't revalidate the pages that show their data.
4. Recommend the smallest change: revalidatePath, a tag, or making one fetch dynamic.
5. Explain the change in one sentence per page.

## Output

A per-page caching summary with the recommended fixes.
