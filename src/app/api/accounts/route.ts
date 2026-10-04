import { NextResponse } from "next/server";
import { parseAccountInput } from "@/lib/account-input";
import { verifyAccount } from "@/lib/mail";
import { startScans } from "@/lib/scanner";
import { denyUnlessAdmin } from "@/lib/session";
import { accountExists, createAccount, listAccounts } from "@/lib/store";

export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  return NextResponse.json({ accounts: listAccounts() });
}

/**
 * Add a mailbox: verify the login, save it encrypted, and start a first scan.
 * Body: see parseAccountInput, plus optional `scan`: "inbox" (default), "all" or false.
 */
export async function POST(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const parsed = parseAccountInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (accountExists(parsed.account.email, parsed.account.protocol)) {
    return NextResponse.json({ error: "This mailbox is already added." }, { status: 409 });
  }

  try {
    await verifyAccount(parsed.account);
  } catch (err) {
    // 422, not 401: the request was authorised but the mailbox login failed.
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  const id = createAccount(parsed.account, parsed.label);
  const scan = body.scan === false ? null : body.scan === "all" ? "all" : "inbox";
  if (scan) startScans([id], scan, 500);
  const account = listAccounts().find((a) => a.id === id);
  return NextResponse.json({ id, account, scanning: scan ?? false }, { status: 201 });
}
