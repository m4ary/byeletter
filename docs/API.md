# Byeletter API

Everything the web interface does is available over HTTP with JSON, so you can add mailboxes and run scans from scripts or other tools.

## Authentication

Set `API_KEY` to a random value of **at least 32 characters** and restart Byeletter:

```bash
openssl rand -hex 32
```

Send it as a bearer token on every request:

```
Authorization: Bearer <API_KEY>
```

- Without `API_KEY`, the API only works from a browser that has unlocked the app with `ADMIN_PASSWORD`.
- A missing or wrong key returns `401`. Keys shorter than 32 characters are ignored, so they never work.
- The key gives full access, the same as the admin password. Keep it secret, and use HTTPS when calling Byeletter from another machine.

The examples assume:

```bash
BYELETTER=http://localhost:3000
API_KEY=your-key
```

## Add a mailbox

`POST /api/accounts`

Byeletter logs in to check the credentials, saves the mailbox encrypted, and starts a first scan.

For a known provider, the email address and an app password are enough; the provider is picked from the email domain:

```bash
curl -X POST "$BYELETTER/api/accounts" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"email": "me@gmail.com", "password": "your-app-password", "label": "Personal"}'
```

For any other server:

```bash
curl -X POST "$BYELETTER/api/accounts" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "providerId": "custom",
    "email": "me@example.com",
    "password": "secret",
    "protocol": "imap",
    "incoming": { "host": "mail.example.com", "port": 993, "secure": true },
    "smtp": { "host": "mail.example.com", "port": 465, "secure": true },
    "scan": "all"
  }'
```

| Field | Required | Description |
| --- | --- | --- |
| `email` | yes | Email address |
| `password` | yes | Password or app password |
| `providerId` | no | A preset from [`GET /api/providers`](#list-providers), or `custom`. Detected from the email domain when omitted |
| `protocol` | no | `imap` (default) or `pop3` |
| `username` | no | Login name, if different from the email address |
| `label` | no | Display name, e.g. `Work` (defaults to the email address) |
| `incoming` | `custom` only | `{ "host", "port", "secure" }`. `secure: true` means SSL/TLS (usually 993 or 995), `false` means STARTTLS or plain |
| `smtp` | no, `custom` only | Same shape, used to send email unsubscribes |
| `allowSelfSigned` | no, `custom` only | `true` to accept self-signed certificates |
| `scan` | no | First scan: `"inbox"` (default), `"all"` for all folders (IMAP), or `false` for none |

**Response** `201 Created`:

```json
{
  "id": "353e3c3c-4330-4911-b534-a8637686b1f9",
  "account": { "id": "353e3c3c-…", "label": "Personal", "email": "me@gmail.com", "providerId": "gmail", "protocol": "imap", "hasSmtp": true, "…": "…" },
  "scanning": "inbox"
}
```

| Status | Meaning |
| --- | --- |
| `201` | Added |
| `400` | Missing or invalid fields, unknown provider, or no preset for the email domain |
| `401` | Missing or wrong API key |
| `409` | That mailbox (same email and protocol) is already added |
| `422` | The mail server rejected the login, or couldn't be reached. The `error` field says why |

Errors look like `{ "error": "message" }`.

## Other endpoints

| Method and path | Body | Description |
| --- | --- | --- |
| `GET /api/providers` | | Provider presets: `id`, `name`, email `domains`, supported `protocols`, whether `smtp` is included, and setup `note` |
| `GET /api/accounts` | | All mailboxes, with newsletter counts and last scan details. Passwords are never returned |
| `PATCH /api/accounts/{id}` | `{ "label": "New name" }` | Rename a mailbox |
| `DELETE /api/accounts/{id}` | | Remove a mailbox with its saved credentials and results |
| `POST /api/scan` | `{ "accountIds": ["…"], "scope": "inbox" \| "all", "limit": 500 }` | Start background scans. Omit `accountIds` to scan every mailbox. `limit` is the newest messages per folder (1–5000). Returns `202` |
| `GET /api/scan` | | Live progress of running scans, by mailbox id |
| `GET /api/overview` | | Mailboxes, scan progress, every newsletter found and totals |
| `POST /api/unsubscribe` | `{ "accountId": "…", "address": "news@example.com", "action": "unsubscribe" }` | Unsubscribe from a sender found by a scan. `action` can also be `mark-done` or `reset` |

### Example: add a mailbox, scan all folders, list newsletters

```bash
ID=$(curl -s -X POST "$BYELETTER/api/accounts" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"email": "me@gmail.com", "password": "your-app-password", "scan": false}' | jq -r .id)

curl -s -X POST "$BYELETTER/api/scan" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"accountIds\": [\"$ID\"], \"scope\": \"all\"}"

# a minute later
curl -s "$BYELETTER/api/overview" -H "Authorization: Bearer $API_KEY" \
  | jq '.newsletters[] | {name, address, count}'
```

## List providers

`GET /api/providers` returns entries like:

```json
{ "id": "gmail", "name": "Gmail", "domains": ["gmail.com", "googlemail.com"], "protocols": ["imap", "pop3"], "smtp": true, "note": "Requires 2-Step Verification and an App Password…" }
```
