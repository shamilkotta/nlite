import { Counter } from "../components/counter";
import { EnvView } from "../components/env-view";
import { Mounted } from "../components/mounted";
import { PropsView } from "../components/props-view";

export default function Page() {
  return (
    <main>
      <p id="styled">styled text</p>
      <p id="server-secret">{process.env.E2E_SERVER_SECRET ?? "missing"}</p>
      <Counter initial={5} label="from the server" />
      <PropsView date={new Date("2024-01-02T03:04:05.000Z")} nested={{ a: { b: "deep" } }} list={[1, 2, 3]}>
        <strong id="server-child">server child</strong>
      </PropsView>
      <EnvView />
      <Mounted />
    </main>
  );
}
