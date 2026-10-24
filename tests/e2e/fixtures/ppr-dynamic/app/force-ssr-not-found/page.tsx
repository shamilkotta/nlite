import { notFound } from "nlite/navigation";

export const rendering = "force-ssr";

export default function Page() {
  notFound();
}
