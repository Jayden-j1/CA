// lib/sanity/queries.ts
//
// ============================================================
// ✅ Purpose
// Central source of GROQ strings used across API routes & server code.
//
// 🧱 Pillars
// - Efficiency   : Only expose fields required by the UI.
// - Robustness   : coalesce() for predictable shapes; NO JS "??".
// - Simplicity   : Plain strings; no external tag helpers required.
// - Ease of mgmt : One file for all query logic.
// - Security     : Avoid broad wildcards.
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
// FIXES:
// - Replaced all JS "??" with GROQ coalesce()
// - Closed all projections and braces
// - Ensured optional fields are guarded with coalesce()
// - Exposes module/submodule-level video/content for single-lesson fallback
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
        ),

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
