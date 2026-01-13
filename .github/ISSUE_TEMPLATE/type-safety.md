---
name: Improve Type Safety
about: Replace 'any' types with proper interfaces
title: 'Improve type safety by replacing any types with proper interfaces'
labels: enhancement, technical-debt
assignees: ''
---

## Problem
Multiple functions and methods use `any` type which reduces type safety and IDE support.

## Affected Areas
- `handler` functions return `Promise<any>`
- `getInsights()` returns `Promise<any>`
- `request()` returns `Promise<any>`
- `getRecommendation()` accepts `igInsights: any`
- `putSecretValue()` accepts `value: any`

## Proposed Solution
Create proper TypeScript interfaces for:
- Instagram API responses
- LLM responses
- Handler return types
- Secrets Manager values

## Benefits
- Better IDE autocomplete
- Compile-time error checking
- Improved code documentation
- Easier refactoring
