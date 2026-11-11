---
title: FastAPI endpoint review
description: Reviews FastAPI endpoints for validation, status codes, auth and response models.
author: lena
stack: Python
tags: [python, fastapi, api]
stars: 9
---
# FastAPI endpoint review

Reviews FastAPI endpoints for validation, status codes, auth and response models.

## When to use

Use this skill when adding or changing endpoints in a FastAPI service.

## Steps

1. Check every endpoint has typed request and response models.
2. Check status codes match the outcome, for example 201 for creation and 404 for missing items.
3. Check authentication dependencies are applied where they should be.
4. Look for blocking calls inside async endpoints.
5. Check errors return a consistent JSON shape.

## Output

A list of endpoints with issues found and suggested fixes.
