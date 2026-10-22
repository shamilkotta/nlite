import { cookies } from "nlite/headers";

async function stamp(label: string) {
  "use cache";
  return `${label}:${crypto.randomUUID()}`;
}

async function First() {
  return <p id="first-a">{await stamp("a")}</p>;
}

async function Second() {
  return <p id="second-a">{await stamp("a")}</p>;
}

export default async function Page() {
  await cookies();
  return (
    <main>
      <First />
      <Second />
      <p id="b">{await stamp("b")}</p>
    </main>
  );
}
