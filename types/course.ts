// types/course.ts
//
// Purpose
// -------
// Reusable TypeScript interfaces that describe your course DTOs
// exactly as returned by /api/courses/[slug].
//
// Pillars
// -------
// - Simplicity: clear and minimal.
// - Robustness: optional fields where appropriate.
// - Ease of management: central definitions used across pages/APIs.

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
  body?: string;
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

/**
 * Optional read-only progress metadata returned by /api/courses/progress (GET).
 * This is *separate* from the granular client-side indices & answers.
 * Keep it minimal and schema-aligned.
 */
export interface UserCourseProgressDTO {
  completedModuleIds: string[];
  lastModuleId: string | null;
  percent: number | null; // 0..100 or null if not computed
}
