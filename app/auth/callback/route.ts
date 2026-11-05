import { handleCallback } from "@/lib/auth/magic-link";

export async function GET(request: Request) {
  return handleCallback(request);
}
