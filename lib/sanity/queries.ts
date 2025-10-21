// lib/sanity/queries.ts
//
// ============================================================
// ✅ Purpose
// Central source of GROQ strings used across API routes & server code.
//
// 🧱 Pillars
// - Efficiency   : Only expose the fields required by the UI.
// - Robustness   : coalesce() for predictable shapes.
// - Simplicity   : Queries as raw strings (no extra tag helper).
// - Ease of mgmt : One file for all query logic.
// - Security     : Avoid broad wildcards that could leak data.
// ============================================================

// ------------------------------------------------------------
// 📘 COURSE LIST QUERY (Lightweight for list views)
// ------------------------------------------------------------
export const COURSE_LIST_QUERY = `
  *[_type == "course" && defined(slug.current)] | order(title asc) {
    "id": _id,
    "slug": slug.current,
    title
  }
`;

// ------------------------------------------------------------
// 📘 COURSE DETAIL BY SLUG (Modules → Lessons → Submodules)
// ------------------------------------------------------------
export const COURSE_DETAIL_BY_SLUG = `
  *[_type == "course" && slug.current == $slug][0]{
    "id": _id,
    "slug": slug.current,
    title,
    "summary": coalesce(summary, null),
    "coverImage": coalesce(coverImage.asset->url, null),

    "modules": coalesce(
      modules[]-> | order(order asc){
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
                "options": options[] ?? [],
                "correctIndex": correctIndex
              }
            }, null)
          },
          []
        ),

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
                    "options": options[] ?? [],
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
