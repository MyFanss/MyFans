# API Versioning and Deprecation Policy

## Overview
The API has formalized namespace versioning. All new endpoints and integrations should map to the `v1` prefix (`/v1/*`). This allows the system to change without breaking legacy clients. 

## Accessing Routes
- **Versioned routes**: Connect to prefix `/v1` before routes. Example: `GET /v1/creators`
- **Legacy requests**: Any request made without a version scope (e.g. `GET /creators`) is automatically mapped to the underlying route mechanism.

## Deprecation Notice
To help ease transition for earlier implementations, old routes are preserved as fallback paths but are heavily deprecated.

Clients accessing *unversioned* URLs will receive standard system indications:

1. A `Deprecation: true` HTTP header is injected into the response.
2. A `Warning: 299 - "This versionless API route is deprecated..."` header is supplied.

Applications should monitor these headers, report occurrences iteratively, and shift their traffic endpoints to `/v1/*` explicitly over time.
