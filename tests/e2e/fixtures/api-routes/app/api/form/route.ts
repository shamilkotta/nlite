export async function POST(request: Request) {
  const form = await request.formData();
  return Response.json({ name: form.get("name"), tags: form.getAll("tag") });
}
