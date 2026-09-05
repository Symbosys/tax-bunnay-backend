import type { ZodError } from "zod";

export const zodError = (error: ZodError) => {
  let errors: any = {};
  error.issues.map((issue) => {
    const path = issue.path?.[0];
    if (path) errors[path] = issue.message;
  });
  return errors;
};
