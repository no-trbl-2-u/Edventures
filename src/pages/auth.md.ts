import type { APIRoute } from "astro";
import { abs, ENDPOINTS } from "../lib/agent-discovery";
import { SITE } from "../lib/site";

/**
 * /auth.md -- how an agent authenticates here, which is: it doesn't.
 *
 * The honest version of this document. There is no authorization server, no
 * token, no registration and nothing behind a login, so the companion
 * `/.well-known/oauth-authorization-server` and
 * `/.well-known/oauth-protected-resource` documents are deliberately **not**
 * published: RFC 8414 and RFC 9728 describe issuers and protected resources,
 * and inventing an `issuer` for a static pet-sitting site would send agents
 * hunting for a token endpoint that will never answer. "No credentials
 * required" is a real answer, and it is the one that saves an agent a round
 * trip -- so it is stated here, plainly, rather than left to be inferred from
 * four missing files.
 *
 * If a login ever exists (Roadmap Phase 6 puts a database behind bookings),
 * this file and those two well-knowns get written together, not before.
 */
export const GET: APIRoute = () => {
  const body = `# auth.md

Agent authentication policy for **${SITE.name}** (${SITE.url}).

## Summary

**No authentication is required, and none is offered.** There is no account, no
API key, no OAuth issuer and no registration endpoint. Every published API is
open to anonymous requests.

Because there is nothing to authenticate to, this site does **not** publish
\`/.well-known/oauth-authorization-server\`, \`/.well-known/openid-configuration\`
or \`/.well-known/oauth-protected-resource\`. Their absence is deliberate, not an
oversight — do not treat it as a signal to go looking for a token endpoint.

## Resource identifier

\`${SITE.url}\`

## Endpoints and what they need

| Endpoint | Method | Credentials | Notes |
| --- | --- | --- | --- |
| \`${ENDPOINTS.health}\` | GET | none | Liveness, and whether bookings can currently be accepted. |
| \`${ENDPOINTS.mcp}\` | POST | none | MCP over Streamable HTTP. Read-only tools. Stateless — no session id. |
| \`${ENDPOINTS.booking}\` | POST | none | Submits a booking request. Rate-limited per IP. |

Machine-readable description: \`${abs(ENDPOINTS.openapi)}\`.
Human reference: \`${abs(ENDPOINTS.apiDocs)}\`.

## Rate limiting

\`${ENDPOINTS.booking}\` is rate-limited per client IP and answers \`429\` when the
limit is exceeded. There is no key that raises the limit and no way to request
one. On a \`429\`, stop and offer ${SITE.phone} instead of retrying.

## Identifying yourself

Send a descriptive \`User-Agent\` with a contact URL. It is not enforced and
nothing is refused for lacking one, but it is what lets ${SITE.owner} tell an
agent acting for a customer from a scraper if traffic ever needs looking at.

## What agents may do

- Read every page, \`${ENDPOINTS.llms}\`, \`${ENDPOINTS.llmsFull}\`, and the
  discovery documents under \`/.well-known/\`.
- Call any MCP tool. All of them are read-only.
- Quote prices from the published list, stating that they are estimates.

## What agents should not do

- **Do not submit a booking on someone's behalf without their say-so.**
  \`${ENDPOINTS.booking}\` collects a home address, an entry arrangement and an
  emergency contact, and a submission commits ${SITE.owner}'s time. The
  \`consent\` field is a person's acknowledgement that this is a request rather
  than a confirmed booking; asserting it for them empties it of meaning.
- **Do not send an actual key code, lockbox combination or hiding place.** The
  entry-method field takes a category only. Those details are settled in person.
- **Do not report a booking as confirmed.** A \`200\` means the request reached
  ${SITE.owner}. He confirms every one by hand.
- **Do not state that this business is insured.** It is not a claim it makes.

## Contact

${SITE.owner} — ${SITE.phone} (text preferred) — ${SITE.email}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
