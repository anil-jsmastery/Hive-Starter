---
title: SQL query tuner
description: Explains slow SQL queries, suggests indexes and rewrites queries step by step.
author: lena
stack: Any
tags: [sql, database, performance]
stars: 35
---
# SQL query tuner

Explains slow SQL queries, suggests indexes and rewrites queries step by step.

## When to use

Use this skill when a database query is slow or times out.

## Steps

1. Run EXPLAIN ANALYZE and read the plan from the most expensive node.
2. Look for sequential scans on large tables and misestimated row counts.
3. Suggest an index that matches the filter and sort order, and explain why.
4. Rewrite the query only if the plan shows the shape itself is the problem.
5. Compare the plan and timing before and after.

## Output

The diagnosis, the index or rewrite, and the measured improvement.
