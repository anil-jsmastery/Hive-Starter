---
title: Pytest test writer
description: Writes pytest tests with fixtures and parametrize, covering edge cases and errors.
author: nora
stack: Python
tags: [python, testing, pytest]
stars: 18
---
# Pytest test writer

Writes pytest tests with fixtures and parametrize, covering edge cases and errors.

## When to use

Use this skill when a Python module has no tests or brittle ones.

## Steps

1. Read the module and list each function's inputs, outputs and exceptions.
2. Use parametrize for cases that share the same shape.
3. Use fixtures for setup that several tests share.
4. Test raised exceptions with pytest.raises and check the message.
5. Keep each test independent so they can run in any order.

## Output

A test_*.py file ready to run with pytest.
