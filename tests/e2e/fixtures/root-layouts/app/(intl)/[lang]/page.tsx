export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <h1 id={`page-${lang}`}>{lang}</h1>;
}
