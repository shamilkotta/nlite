export const posts = [
  { slug: "hello", title: "Hello", body: "The first post." },
  { slug: "routing", title: "Routing", body: "Files in app/ become routes." },
  { slug: "rendering", title: "Rendering", body: "Static when possible, on demand when needed." },
];

export function getPost(slug: string) {
  return posts.find((post) => post.slug === slug);
}
