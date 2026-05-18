import { Badge } from "./Badge";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
};

export function PageHeader({ eyebrow, title, description, badge }: PageHeaderProps) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <div className="page-header-row">
        <h1>{title}</h1>
        {badge ? <Badge>{badge}</Badge> : null}
      </div>
      <p className="lede">{description}</p>
    </header>
  );
}
