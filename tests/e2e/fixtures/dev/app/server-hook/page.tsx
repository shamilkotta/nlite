import { usePathname } from "nlite/navigation";

// Client hooks are not available to Server Components
export default function Page() {
  return <p>{usePathname()}</p>;
}
