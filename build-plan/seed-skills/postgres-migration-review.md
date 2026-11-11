---
title: Postgres migration review
description: Reviews a Postgres migration for locks, data loss and safe rollout before it runs.
author: lena
stack: Any
tags: [sql, postgres, migrations]
stars: 26
---
# Postgres migration review

Reviews a Postgres migration for locks, data loss and safe rollout before it runs.

## When to use

Use this skill when a schema migration is about to run on a database with real data.

## Steps

1. Read each statement and note which tables it locks and for how long.
2. Flag column drops, type changes and renames that can lose data or break running code.
3. Check new indexes are created concurrently on large tables.
4. Check new not-null columns have a default or a backfill step.
5. Write the rollback for each statement.

## Output

A risk rating per statement, the rollout order and the rollback plan.
