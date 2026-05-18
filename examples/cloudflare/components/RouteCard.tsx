import Link from "nlite/link";

import { Badge } from "./Badge";

type RouteCardProps = {
  href: string;
  title: string;
  description: string;
  badge: string;
};

export function RouteCard({ href, title, description, badge }: RouteCardProps) {
  return (
    <Link href={href} className="route-card">
      <div className="route-card-header">
        <h3>{title}</h3>
        <Badge tone="accent">{badge}</Badge>
      </div>
      <p>{description}</p>
    </Link>
  );
}
