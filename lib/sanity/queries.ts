// lib/sanity/queries.ts
//
// Purpose
// -------
// Centralized GROQ queries for reusability + consistency.
// These feed your API routes and server components.
//
// Pillars
// -------
// ✅ Efficiency  – Only fetch what the UI needs
// ✅ Robustness  – coalesce() for predictable shapes
// ✅ Simplicity  – All queries in one place, no inline string builds
// ✅ Security    – No wildcards that leak data
//
import { groq } from "next-sanity";

// ------------------------------------------------------------
// COURSE LIST QUERY (lightweight lists / selectors)
// ------------------------------------------------------------
export const COURSE_LIST_QUERY = groq`
  *[_type == "course" && defined(slug.current)] | order(title asc) {
    "id": _id,
    "slug": slug.current,
    title
  }
`;

// ------------------------------------------------------------
// COURSE DETAIL BY SLUG (with modules → lessons → submodules)
// ------------------------------------------------------------
// 👉 Important ordering rules:
//   • We respect *array order* in the Course's "modules" field (drag/drop).
//   • We also support each Module/Lesson "order" field if you use it.
//   • The pipes `| order(order asc)` are applied after dereferencing `->`.
//
// 👉 Result shape is stable and UI-ready, with all optional fields normalized.
//
export const COURSE_DETAIL_BY_SLUG = groq`
  *[_type == "course" && slug.current == $slug][0]{
    // Core course fields
    "id": _id,
    "slug": slug.current,
    title,
    "summary": coalesce(summary, null),
    "coverImage": coalesce(coverImage, null),

    // Course → Modules (respect array order first, then module.order as a hint)
    "modules": coalesce(
      modules[]-> | order(order asc){
        _id,
        title,
        "description": coalesce(description, null),
        "order": select(defined(order) => order, null),

        // Lessons (respect embedded array order, then lesson.order)
        "lessons": coalesce(
          lessons[]-> | order(order asc){
            _id,
            title,
            "order": select(defined(order) => order, null),
            "videoUrl": coalesce(videoUrl, null),
            "body": coalesce(body, []),
            "quiz": coalesce(quiz{
              "passingScore": passingScore,
              "questions": questions[] {
                "id": coalesce(id, _key),
                "question": question,
                "options": options[],
                "correctIndex": correctIndex
              }
            }, null)
          },
          []
        ),

        // Optional submodules (same rules + same shape as modules)
        "submodules": coalesce(
          submodules[]-> | order(order asc){
            _id,
            title,
            "description": coalesce(description, null),
            "order": select(defined(order) => order, null),

            "lessons": coalesce(
              lessons[]-> | order(order asc){
                _id,
                title,
                "order": select(defined(order) => order, null),
                "videoUrl": coalesce(videoUrl, null),
                "body": coalesce(body, []),
                "quiz": coalesce(quiz{
                  "passingScore": passingScore,
                  "questions": questions[] {
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
