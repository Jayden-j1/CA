// lib/sanity/queries.ts
//
// Purpose
// -------
// Define GROQ queries in a single place for reusability and consistency.
// These queries feed your API routes and server actions.
//
// Design Pillars
// --------------
// ✅ Efficiency  – Only query necessary fields.
// ✅ Robustness  – Use coalesce() to normalize missing fields.
// ✅ Simplicity  – Avoid over-nesting or inline JS interpolation.
// ✅ Ease of management  – Central file for all Sanity data shapes.
// ✅ Security  – Strictly controlled data exposure (no wildcards).

import { groq } from "next-sanity";

// ------------------------------------------------------------
// COURSE LIST QUERY
// ------------------------------------------------------------
// Minimal query used by `/api/courses` for dashboard lists.
// Returns id, slug, and title only.
export const COURSE_LIST_QUERY = groq`
  *[_type == "course" && defined(slug.current)] | order(title asc) {
    "id": _id,
    "slug": slug.current,
    title
  }
`;

// ------------------------------------------------------------
// COURSE DETAIL QUERY (WITH HIERARCHICAL MODULES + LESSONS)
// ------------------------------------------------------------
// Returns the full course structure for `/api/courses/[slug]`.
// This includes modules, submodules, lessons, and Portable Text bodies.
//
// Key Notes:
//  • Never interpolate variables via ${...}, only pass parameters (e.g. $slug).
//  • Keep all field keys quoted to prevent TypeScript/GROQ parsing errors.
//  • The query below is static — no TypeScript will be inferred from its content.
//  • Portable Text arrays are fetched as-is for rendering in the frontend.
export const COURSE_DETAIL_BY_SLUG = groq`
  *[_type == "course" && slug.current == $slug][0]{
    // Core fields
    "id": _id,
    "slug": slug.current,
    title,
    "summary": coalesce(summary, null),
    "coverImage": coalesce(coverImage, null),

    // Ordered modules (array of references)
    "modules": coalesce(
      modules[]->{
        _id,
        title,
        "description": coalesce(description, null),
        "order": select(defined(order) => order, null),

        // Lessons within each module
        "lessons": coalesce(
          lessons[]->{
            _id,
            title,
            "order": select(defined(order) => order, null),
            "videoUrl": coalesce(videoUrl, null),
            "body": coalesce(body, []),
            "quiz": coalesce(quiz{
              "passingScore": passingScore,
              "questions": questions[]{
                "id": coalesce(id, _key),
                "question": question,
                "options": options[],
                "correctIndex": correctIndex
              }
            }, null)
          },
          []
        ),

        // Optional nested submodules (same shape)
        "submodules": coalesce(
          submodules[]->{
            _id,
            title,
            "description": coalesce(description, null),
            "order": select(defined(order) => order, null),
            "lessons": coalesce(
              lessons[]->{
                _id,
                title,
                "order": select(defined(order) => order, null),
                "videoUrl": coalesce(videoUrl, null),
                "body": coalesce(body, []),
                "quiz": coalesce(quiz{
                  "passingScore": passingScore,
                  "questions": questions[]{
                    "id": coalesce(id, _key),
                    "question": question,
                    "options": options[],
                    "correctIndex": correctIndex
                  }
                }, null)
              },
              []
            )
          },
          []
        )
      },
      []
    )
  }
`;
