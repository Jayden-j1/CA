// cms/schemas/course.js
//
// Purpose:
// - Defines course-level metadata and references to modules.

export default {
  name: "course",
  title: "Course",
  type: "document",
  fields: [
    { name: "slug", type: "slug", title: "Slug", options: { source: "title" } },
    { name: "title", type: "string", title: "Title" },
    { name: "summary", type: "text", title: "Summary" },
    {
      name: "modules",
      title: "Modules",
      type: "array",
      of: [{ type: "reference", to: [{ type: "module" }] }],
    },
  ],
};
