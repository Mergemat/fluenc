// Accounts in the ui-check database besides the demo learner.
export interface Learner {
  email: string;
  /** Lessons already taken, in course order. */
  lessons: number;
  /** Whether those lessons named their clues, so later ones start with some filled in. */
  named: boolean;
  password: string;
}

export const DEMO = { email: "demo@example.com", password: "demo-password" };

export const learners = [
  // Next: 个, two parts.
  {
    email: "pair@example.com",
    password: "ui-check-password",
    lessons: 1,
    named: true,
  },
  // Next: 候, five parts in two columns, some already named.
  {
    email: "dense@example.com",
    password: "ui-check-password",
    lessons: 146,
    named: true,
  },
  // Next: 发, four parts and a note on how they fit, nothing named.
  {
    email: "note@example.com",
    password: "ui-check-password",
    lessons: 375,
    named: false,
  },
] satisfies Learner[];

export type LearnerName = "demo" | "pair" | "dense" | "note";

export const credentials = (name: LearnerName) =>
  name === "demo"
    ? DEMO
    : (learners.find((learner) => learner.email.startsWith(`${name}@`)) ??
      DEMO);
