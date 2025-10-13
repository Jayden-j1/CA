// pages/cms/[[...tool]].tsx
//
// Purpose:
//   Runs the Sanity Studio at /cms using the classic "pages" router.
//   This avoids the React.createContext() errors seen when embedding
//   Studio in the Next.js App Router.

import { NextStudio } from "next-sanity/studio";
import config from "../../cms/sanity.config"; // relative path

export default function StudioPage() {
  return <NextStudio config={config} />;
}
