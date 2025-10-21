// cms/schemas/resource.ts
import { defineType, defineField } from "sanity";

export default defineType({
  name: "resource",
  title: "Cultural Resource",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", title: "Title" }),
    defineField({ name: "url", type: "url", title: "Resource Link" }),
    defineField({ name: "description", type: "text", title: "Description" }),
  ],
});
