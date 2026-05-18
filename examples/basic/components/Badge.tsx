type BadgeProps = {
  children: string;
  tone?: "neutral" | "accent" | "muted";
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
