// lib/sanity/queries.ts
//
// ============================================================
// ✅ Purpose
// Central source of GROQ strings used across API routes & server code.
//
// 🧱 Pillars
// - Efficiency   : Only expose the fields required by the UI.
// - Robustness   : coalesce() for predictable shapes; *no* JS "??" operator.
// - Simplicity   : Queries as raw strings (avoids extra runtime deps).
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
// IMPORTANT FIXES compared to your previous version:
// - Replaced any "??" (JS) with GROQ `coalesce()`
// - Ensured every projection has matching braces
// - Added optional fields safely via `coalesce(...)`
// - Kept shape stable for your front-end DTO/flattening
export const COURSE_DETAIL_BY_SLUG = `
  *[_type == "course" && slug.current == $slug][0]{
    "id": _id,
    "slug": slug.current,
    title,
    "summary": coalesce(summary, null),
    "coverImage": coalesce(coverImage.asset->url, null),

    // Top-level modules (ordered)
    "modules": coalesce(
      modules[]-> | order(order asc){
        _id,
        title,
        "description": coalesce(description, null),
        "order": select(defined(order) => order, null),
        "videoUrl": coalesce(videoUrl, null),
        "content": content,

        // Lessons (ordered)
        "lessons": coalesce(
          lessons[]-> | order(order asc){
            _id,
            title,
            "order": select(defined(order) => order, null),
            "videoUrl": coalesce(videoUrl, null),
            "body": coalesce(body, []),

            // Quiz object (if present)
            "quiz": select(
              defined(quiz) => {
                "title": coalesce(quiz.title, null),
                "passingScore": quiz.passingScore,
                "questions": coalesce(quiz.questions, [])[]{
                  "id": coalesce(id, _key),
                  "question": question,
                  "options": coalesce(options, []),
                  "correctIndex": correctIndex
                }
              },
              null
            )
          },
          []
        ),

        // Optional authoring: nested submodules (ordered)
        "submodules": coalesce(
          submodules[]-> | order(order asc){
            _id,
            title,
            "description": coalesce(description, null),
            "order": select(defined(order) => order, null),
            "videoUrl": coalesce(videoUrl, null),
            "content": content,

            "lessons": coalesce(
              lessons[]-> | order(order asc){
                _id,
                title,
                "order": select(defined(order) => order, null),
                "videoUrl": coalesce(videoUrl, null),
                "body": coalesce(body, []),
                "quiz": select(
                  defined(quiz) => {
                    "title": coalesce(quiz.title, null),
                    "passingScore": quiz.passingScore,
                    "questions": coalesce(quiz.questions, [])[]{
                      "id": coalesce(id, _key),
                      "question": question,
                      "options": coalesce(options, []),
                      "correctIndex": correctIndex
                    }
                  },
                  null
                )
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
