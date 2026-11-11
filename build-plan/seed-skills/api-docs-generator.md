---
title: API docs generator
description: Turns route handlers into readable API documentation with request and response examples.
author: kenji
stack: Node.js
tags: [docs, api]
stars: 22
---
# API docs generator

Turns route handlers into readable API documentation with request and response examples.

## When to use

Use this skill when documenting a REST API from its route handlers.

## Steps

1. List every route with its method and path, grouped by resource.
2. For each route, read the handler and note path params, query params, body shape and status codes.
3. Write one realistic request and response example per route, using the real field names.
4. Mark which routes need authentication and what happens when it's missing.
5. Flag handlers whose behaviour is unclear instead of guessing.

## Output

A Markdown document with one section per resource, a table of routes, and the examples.
