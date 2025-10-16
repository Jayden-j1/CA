// lib/sanity/queries.ts
//
// Purpose
// -------
// Centralize GROQ queries that project Sanity docs into the
// structure your app expects. Supports nested sub-modules and
// rich Portable Text (with images + video embeds).
//
// Notes
// -----
// • Arrays preserve author order. We also expose numeric `order`
//   for future merging/sorting logic if needed.
// • Lessons return full PT arrays so the client can render images
//   and embedded videos using <PortableTextRenderer />.

import { groq } from "next-sanity";

// Minimal list (id/slug/title) – expand as needed for cards
export const COURSE_LIST_QUERY = groq`
  *[_type == "course" && defined(slug.current)] | order(title asc) {
    "id": _id,
    "slug": slug.current,
    title
  }
`;

// Full course by slug
// - modules[] are dereferenced in order
// - subModules[] are dereferenced one level deep (recursive expansion
//   beyond this is possible but usually unnecessary for authoring)
export const COURSE_DETAIL_BY_SLUG = groq`
*[_type == "course" && slug.current == $slug][0]{
  "id": _id,
  "slug": slug.current,
  title,
  "summary": coalesce(summary, null),
  "coverImage": coalesce(coverImage, null),

  // Top-level modules in author-defined order
  "modules": coalesce(modules[]->{
    "id": _id,
    title,
    "description": coalesce(description, null),
    "order": select(defined(order) => order, null),

    // Ordered lessons
    "lessons": coalesce(lessons[]->{
      "id": _id,
      title,
      "order": select(defined(order) => order, null),
      "videoUrl": coalesce(videoUrl, null),

      // IMPORTANT: Portable Text (blocks + images + videoEmbed objects)
      "body": coalesce(body, []),

      // Structured quiz (if present)
      "quiz": coalesce(quiz{
        "questions": questions[] {
          "id": coalesce(id, _key),
          "question": question,
          "options": options[],
          "correctIndex": correctIndex
        }
      }, null)
    }, []),

    // One level of nested sub-modules (also ordered)
    "subModules": coalesce(subModules[]->{
      "id": _id,
      title,
      "description": coalesce(description, null),
      "order": select(defined(order) => order, null),
      "lessons": coalesce(lessons[]->{
        "id": _id,
        title,
        "order": select(defined(order) => order, null),
        "videoUrl": coalesce(videoUrl, null),
        "body": coalesce(body, []),
        "quiz": coalesce(quiz{
          "questions": questions[] {
            "id": coalesce(id, _key),
            "question": question,
            "options": options[],
            "correctIndex": correctIndex
          }
        }, null)
      }, [])
    }, [])
  }, [])
}
`;
