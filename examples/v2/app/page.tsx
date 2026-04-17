import Counter from "../shared/Counter";

export default function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">Vite-first framework experiment</p>
      <h1>File routing plus React Server Components on top of Vite.</h1>
      <p>
        This page is rendered as an RSC/SSR route, while the counter remains a client component.
      </p>
      <h1>Hello </h1>
      <Counter />
    </section>
  );
}
