// cms/schemas/module.js
//
// Purpose:
// - Groups lessons together within a course.
// - Keeps module descriptions editable in Sanity.

export default {
  name: "module",
  title: "Module",
  type: "document",
  fields: [
    { name: "title", type: "string", title: "Title" },
    { name: "description", type: "text", title: "Description" },
    {
      name: "lessons",
      title: "Lessons",
      type: "array",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
    },
  ],
};
