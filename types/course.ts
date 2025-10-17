// types/course.ts
//
// Purpose
// -------
// Reusable TypeScript interfaces that describe your course DTOs
// exactly as returned by /api/courses/[slug].
//
// Notes
// -----
// • body can be string OR Portable Text array. We reflect that in types.
// • quiz fields remain minimal to match your current API.

import type { TypedObject } from "@portabletext/types";

export interface CourseQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface CourseQuiz {
  questions: CourseQuizQuestion[];
}

export interface CourseLesson {
  id: string;
  title: string;
  videoUrl: string;
  // Portable Text array OR plain string (normalized by the renderer helper)
  body?: string | TypedObject[];
  quiz?: CourseQuiz;
}

export interface CourseModule {
  id: string;
  title: string;
  description?: string;
  lessons: CourseLesson[];
}

export interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  coverImage?: string | null;
  modules: CourseModule[];
}

export interface UserCourseProgressDTO {
  completedModuleIds: string[];
  lastModuleId: string | null;
  percent: number | null; // 0..100 or null if not computed
}
