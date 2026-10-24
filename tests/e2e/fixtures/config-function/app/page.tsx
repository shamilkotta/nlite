import { greeting } from "@lib/greeting";

declare const __E2E_MODE__: string;

export default function Page() {
  return (
    <main>
      <p id="greeting">{greeting}</p>
      <p id="mode">{__E2E_MODE__}</p>
    </main>
  );
}
