import { Counter } from "../components/counter";
import { ServerGreeting } from "../components/server-greeting";

export default function Page() {
  return (
    <main data-testid="client-page">
      <ServerGreeting name="nlite" />
      <Counter />
    </main>
  );
}
