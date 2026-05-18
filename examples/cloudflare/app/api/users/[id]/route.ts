import { getUserPublicRecord } from "../../../../lib/server/app-data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return Response.json(getUserPublicRecord(id));
}
