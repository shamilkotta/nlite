export function ServerGreeting({ name }: { name: string }) {
  return <p data-testid="server-greeting">Hello from server, {name}</p>;
}
