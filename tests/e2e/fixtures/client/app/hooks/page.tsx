import { headers } from "nlite/headers";

import { HooksView } from "../../components/hooks-view";

export default async function Page() {
  await headers();
  return <HooksView />;
}
