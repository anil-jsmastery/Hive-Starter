---
title: OpenAPI spec writer
description: Writes an OpenAPI 3 spec from an existing API, with schemas and examples.
author: kenji
stack: Node.js
tags: [api, openapi, docs]
stars: 11
---
# OpenAPI spec writer

Writes an OpenAPI 3 spec from an existing API, with schemas and examples.

## When to use

Use this skill when an API needs a machine-readable spec for clients or docs.

## Steps

1. List every route, method, parameter and response.
2. Turn shared request and response shapes into reusable schemas.
3. Describe authentication once and apply it to the routes that need it.
4. Add one example per response.
5. Validate the spec with an OpenAPI linter.

## Output

An openapi.yaml file and a list of routes that need clarification.
