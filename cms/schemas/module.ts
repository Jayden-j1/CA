import { defineField, defineType } from "sanity";

export default defineType({
  name: "module",
  title: "Module",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Module Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
    }),
    defineField({
      name: "lessons",
      title: "Lessons",
      type: "array",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
    }),
  ],
});
