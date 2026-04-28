import Counter from "../shared/Counter";

export const rendering = "ssg";

export default async function HomePage() {
  const data = await new Promise<string>((resolve) =>
    setTimeout(() => resolve("new Data name"), 3000),
  );

  return (
    <section className="hero">
      <p className="eyebrow">Vite-first framework experiment</p>
      <h1>File routing plus React Server Components on top of Vite.</h1>
      <p>
        This page is rendered as an RSC/SSR route, while the counter remains a client component.
      </p>
      <h1>Hello {data}</h1>
      <Counter />
    </section>
  );
}
