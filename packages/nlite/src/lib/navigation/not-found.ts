import { createNotFoundError } from "./errors.js";

export function notFound(): never {
  throw createNotFoundError();
}
