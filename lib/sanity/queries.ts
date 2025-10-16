// lib/sanity/queries.ts
//
// Purpose
// -------
// Centralized GROQ queries that project Sanity docs into the exact
// shape your frontend expects. We do the “shape work” here so API
// routes can stay small and your React components remain stable.
//
// Frontend expects (per your page):
//  - CourseDetail {
//      id, slug, title, summary, coverImage, modules: CourseModule[]
//    }
//  - CourseModule {
//      id, title, description?, lessons: {
//        id, title, videoUrl?, body(string), quiz?: { questions: [...] }
//      }[]
//    }
//
// Implementation details
// ----------------------
//  • We dereference with `->` to materialize nested refs.
//  • We convert Portable Text blocks to plain text for `body` using
//    Sanity's `pt::text(...)` projection function to keep it simple.
//  • We ensure null/[] defaults to keep UI predictable.
//  • We auto-generate question `id` if author leaves it empty.

import { groq } from "next-sanity";

// --- List minimal course info (for your list endpoint) ---
export const COURSE_LIST_QUERY = groq`
*[_type == "course"] | order(title asc) {
  "slug": slug.current
}
`;

// --- Full course by slug, fully dereferenced to the shape your UI expects ---
export const COURSE_DETAIL_BY_SLUG = groq`
*[_type == "course" && slug.current == $slug][0]{
  "id": _id,
  "slug": slug.current,
  title,
  // Short text summary; default to null
  "summary": coalesce(summary, null),
  // Pass-through the raw image object (your app might not use this yet)
  "coverImage": coalesce(coverImage, null),
  // Deref modules and their lessons in order
  "modules": coalesce(modules[]->{
    "id": _id,
    title,
    "description": coalesce(description, null),
    // Lessons in the order they appear in the array
    "lessons": coalesce(lessons[]->{
      "id": _id,
      title,
      // Use the raw URL (or null)
      "videoUrl": coalesce(videoUrl, null),
      // Convert portable text blocks to a single plain text string
      "body": pt::text(body),
      // Structured quiz
      "quiz": coalesce(quiz{
        "questions": questions[]{
          // Auto-generate id if missing: <docId>_q_<index>
          "id": coalesce(id, string(^._id) + "_q_" + string(@.index)),
          "question": question,
          "options": options[],
          "correctIndex": correctIndex
        }
      }, null)
    }, [])
  }, [])
}
`;
