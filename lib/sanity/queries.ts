// lib/sanity/queries.ts
//
// Purpose: expose fields the UI needs, nothing more.
// Change: include module-level "thumbnail" (coalesced URL) so UI can render it.
//
// Safety: purely additive fields; existing consumers remain valid.

export const COURSE_LIST_QUERY = `
  *[_type == "course" && defined(slug.current)] | order(title asc) {
    "id": _id,
    "slug": slug.current,
    title
  }
`;

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
        // ✅ NEW: expose thumbnail URL (or null)
        "thumbnail": coalesce(thumbnail.asset->url, null),

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
            // ✅ NEW (parity): expose thumbnail for submodules too
            "thumbnail": coalesce(thumbnail.asset->url, null),

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









