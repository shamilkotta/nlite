"use client";

export default function AboutError({ error }: { error: Error }) {
  return <p>An error occurred while rendering the page: {error.message}</p>;
}
