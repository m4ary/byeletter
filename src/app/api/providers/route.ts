import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/providers";
import { denyUnlessAdmin } from "@/lib/session";

/** Provider presets for `providerId` when adding a mailbox through the API. */
export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;

  return NextResponse.json({
    providers: PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      domains: p.domains,
      protocols: p.id === "custom" ? ["imap", "pop3"] : (["imap", "pop3"] as const).filter((proto) => p[proto]),
      smtp: p.id === "custom" ? "optional" : Boolean(p.smtp),
      note: p.note ?? null,
    })),
  });
}
