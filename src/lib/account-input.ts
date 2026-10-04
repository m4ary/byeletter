import { detectProvider, getProvider } from "./providers";
import type { MailAccount, Protocol, ServerConfig } from "./types";

function parseServer(value: unknown): ServerConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const host = typeof v.host === "string" ? v.host.trim() : "";
  const port = Number(v.port);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return undefined;
  return { host, port, secure: Boolean(v.secure) };
}

/** Turn the "add mailbox" form body into a MailAccount, or an error message. */
export function parseAccountInput(
  body: Record<string, unknown>,
): { account: MailAccount; label?: string } | { error: string } {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const username = (typeof body.username === "string" && body.username.trim()) || email;
  const protocol: Protocol = body.protocol === "pop3" ? "pop3" : "imap";
  // Without a providerId (e.g. API calls), pick the preset from the email domain.
  const providerId =
    typeof body.providerId === "string" ? body.providerId : (detectProvider(email)?.id ?? "custom");
  const provider = getProvider(providerId);
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : undefined;

  if (!email || !password) return { error: "Email and password are required." };
  if (!provider) return { error: `Unknown provider "${providerId}". See GET /api/providers.` };

  const isCustom = provider.id === "custom";
  const incoming = isCustom ? parseServer(body.incoming) : provider[protocol];
  const smtp = isCustom ? parseServer(body.smtp) : provider.smtp;

  if (!incoming) {
    return {
      error: !isCustom
        ? `${provider.name} does not support ${protocol.toUpperCase()}.`
        : typeof body.providerId === "string"
          ? "Enter a valid incoming server host and port."
          : "No preset for this email domain. Set providerId (see GET /api/providers) or incoming server settings.",
    };
  }

  return {
    label: label || undefined,
    account: {
      providerId: provider.id,
      protocol,
      email,
      username,
      password,
      incoming,
      smtp,
      allowSelfSigned: isCustom ? Boolean(body.allowSelfSigned) : provider.allowSelfSigned,
    },
  };
}
