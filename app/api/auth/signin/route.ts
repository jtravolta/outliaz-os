import type { NextRequest } from "next/server";

import { publicRoute } from "@/lib/api";
import { handleSignIn } from "@/lib/auth/magic-link";

export const POST = publicRoute(async (req: NextRequest) => {
  return handleSignIn(req);
});
