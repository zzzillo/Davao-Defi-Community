# Development notes

## User-facing success and error feedback

Use the existing frontend toast at the top of the screen for user-facing success and error feedback. In a React component, call `useToast()` from `frontend/src/hooks/useToast.ts`, then report outcomes with `showToast('success', message)` or `showToast('error', message)`. Use the same toast for validation failures and API failures so the interface stays consistent.

Avoid adding inline success/error banners for completed actions. Keep inline text for neutral instructions and field help. For page-load failures that need retry, show the error through the toast and keep a separate retry control available.
