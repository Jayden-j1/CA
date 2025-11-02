// app/api/course/progress/route.ts
// Thin compatibility shim: re-export the canonical plural route handlers.
// Safe, minimal, and avoids future 404s if any code still calls /api/course/progress.

export { GET, POST } from "@/app/api/courses/progress/route";
