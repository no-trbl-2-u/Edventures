/**
 * Roadmap 3.7 - sending the mail.
 *
 * Resend over plain `fetch`, not the SDK. The endpoint runs on a Workers-style
 * runtime where every dependency is weight in the bundle, and this is one POST
 * to one documented URL. Adding a package to build that request would be the
 * expensive way to save four lines.
 *
 * Everything above this file talks to the `Mailer` interface, so swapping
 * providers, or dropping in the dry-run mailer for local work, changes one line
 * at the composition root and nothing else.
 */
import type { EmailMessage } from "./booking-emails";

export interface EmailAttachment {
  filename: string;
  /** Text content. Base64 encoding happens at the transport, not here. */
  content: string;
  /** e.g. `text/calendar; charset=utf-8; method=PUBLISH`. */
  contentType: string;
}

export interface OutboundEmail extends EmailMessage {
  to: string;
  /** `Name <address@domain>`. Must be a verified sending domain (3.11). */
  from: string;
  /** Currently only the booking `.ics` (3.14). */
  attachments?: EmailAttachment[];
}

/**
 * UTF-8 safe base64.
 *
 * `btoa` is Latin-1 only and throws on anything above U+00FF, so encoding a
 * `.ics` through it would work until the first customer named Zoë or a pet
 * called Müsli -- and it would fail at confirmation time, the least
 * recoverable moment in the flow. Encoding to bytes first removes the
 * category. Chunked because spreading a large byte array into `String.fromCharCode`
 * blows the argument limit.
 */
export function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export interface Mailer {
  send(message: OutboundEmail): Promise<void>;
}

export class MailerError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "MailerError";
    this.status = status;
  }
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function resendMailer(apiKey: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send(message) {
      const res = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.replyTo ? { reply_to: [message.replyTo] } : {}),
          ...(message.attachments?.length
            ? {
                attachments: message.attachments.map((file) => ({
                  filename: file.filename,
                  content: toBase64(file.content),
                  content_type: file.contentType,
                })),
              }
            : {}),
        }),
      });

      if (!res.ok) {
        // The body carries Resend's own reason -- an unverified domain, a bad
        // key. Worth surfacing, because the alternative is a 502 with no clue
        // why. Capped: no need for a megabyte of HTML in a log line.
        const detail = await res.text().catch(() => "");
        throw new MailerError(
          `Resend responded ${res.status}: ${detail.slice(0, 500)}`,
          res.status,
        );
      }
    },
  };
}

/**
 * Sends nothing and records everything.
 *
 * The point is that the endpoint is fully exercisable without credentials or a
 * verified domain: post a real booking locally and read back exactly what
 * would have gone out. Also what the tests use.
 */
export function dryRunMailer(sink: OutboundEmail[] = []): Mailer & { sent: OutboundEmail[] } {
  return {
    sent: sink,
    async send(message) {
      sink.push(message);
    },
  };
}
