import { getServiceStatus } from "@/lib/server/app-data";

export function GET() {
  return Response.json(getServiceStatus());
}
