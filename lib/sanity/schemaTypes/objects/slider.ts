import { defineType } from "sanity";

export default defineType({
  name: "slider",
  type: "object",
  title: "Slider",
  fields: [
    { name: "title", type: "string", title: "Slider Title" },
    { name: "images", type: "array", title: "Images", of: [{ type: "image" }] },
  ],
});
