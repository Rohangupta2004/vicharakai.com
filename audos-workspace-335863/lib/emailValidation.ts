// Signup email validation — purely code-based (no external API).
// Blocks obviously fake/test addresses, known disposable/temporary email
// domains, and malformed addresses. Used client-side by the EmailGate signup
// flow for immediate feedback; the `validate-signup-email` server hook runs
// the same rules server-side as a safety net. Keep the two lists in sync.

export const SIGNUP_EMAIL_BLOCKED_MESSAGE =
  'Please use a real email address — disposable emails are not allowed.';
export const SIGNUP_EMAIL_FAKE_MESSAGE =
  'Please use a real email address — test or placeholder emails are not allowed.';
export const SIGNUP_EMAIL_FORMAT_MESSAGE =
  "That doesn't look like a valid email address — please check it and try again.";

// Known disposable / temporary email providers (matched exactly or as a
// parent domain, so sub.mailinator.com is blocked too).
export const DISPOSABLE_EMAIL_DOMAINS: string[] = [
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamail.de',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'spam4.me',
  'pokemail.net',
  'tempmail.com',
  'tempmail.net',
  'tempmail.dev',
  'temp-mail.org',
  'temp-mail.io',
  'tempail.com',
  'tempr.email',
  'tempinbox.com',
  'mytemp.email',
  'temporarymail.com',
  'throwaway.email',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'maildrop.cc',
  'trashmail.com',
  'trashmail.de',
  'trashmail.net',
  'trash-mail.com',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'minuteinbox.com',
  'getnada.com',
  'nada.email',
  'inboxkitten.com',
  'dispostable.com',
  'mailnesia.com',
  'mintemail.com',
  'fakeinbox.com',
  'spamgourmet.com',
  'mailcatch.com',
  'mohmal.com',
  'emailondeck.com',
  'burnermail.io',
  'mailsac.com',
  'moakt.com',
  'tmpmail.org',
  'tmpmail.net',
  'disposablemail.com',
  'crazymailing.com',
  'discard.email',
  'discardmail.com',
  'spambog.com',
  'spambog.de',
  'jetable.org',
  'mailexpire.com',
  'mailtemp.io',
  'luxusmail.org',
  '1secmail.com',
  '1secmail.org',
  '1secmail.net',
  'harakirimail.com',
  '33mail.com',
  'mailnull.com',
  'incognitomail.org',
  'deadaddress.com',
  'tempemail.net',
  'binkmail.com',
  'safetymail.info',
  'spamavert.com',
];

// Domains that only ever appear in fake/test signups (example.com is
// IANA-reserved; test.com etc. have no real inboxes behind signups).
export const FAKE_EMAIL_DOMAINS: string[] = [
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.in',
  'test.co',
  'test.org',
  'test.net',
  'testing.com',
  'testmail.com',
  'fake.com',
  'fakemail.com',
  'fakeemail.com',
  'asdf.com',
  'aaa.com',
  'dummy.com',
  'sample.com',
  'invalid.com',
  'notreal.com',
  'noemail.com',
  'nomail.com',
  'nowhere.com',
  'doesnotexist.com',
  'yourdomain.com',
  'mydomain.com',
  'domain.com',
  'email.test',
];

// Reserved / non-routable TLDs (RFC 2606 & friends) — nothing real ends here.
const RESERVED_TLDS = ['test', 'invalid', 'localhost', 'example', 'local'];

// Local parts that are obviously placeholders no matter the domain
// (test@…, fake@…, asdf@…). Matched exactly after lowercasing, plus the
// regex below catches numbered variants like test123@… .
const FAKE_LOCAL_PARTS = new Set([
  'test',
  'testing',
  'tester',
  'testuser',
  'testemail',
  'testtest',
  'fake',
  'fakeemail',
  'fakemail',
  'dummy',
  'sample',
  'example',
  'asdf',
  'asdfasdf',
  'qwerty',
  'qwertyuiop',
  'abc123',
  'noemail',
  'nomail',
  'nobody',
  'noone',
  'notreal',
  'blah',
  'spam',
  'junk',
  'trash',
  'noreply',
  'no-reply',
  'donotreply',
]);

// Catches numbered placeholder variants: test1, test123, fake99, asdf1234…
const FAKE_LOCAL_PART_PATTERN = /^(test|fake|dummy|sample|asdf|qwerty|temp|spam|junk)\d*$/;

// Same character repeated 3+ times as the whole local part: aaa@, xxxx@…
const REPEATED_CHAR_LOCAL_PART = /^(.)\1{2,}$/;

// Structural check: dot-separated local-part atoms (no leading/trailing/double
// dots), domain of hyphen-safe labels, and an alphabetic TLD of 2+ chars.
const EMAIL_FORMAT_REGEX =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export interface SignupEmailValidationResult {
  valid: boolean;
  /** Why the email was rejected. Only set when valid === false. */
  reason?: 'format' | 'disposable' | 'fake';
  /** Friendly, user-displayable error. Only set when valid === false. */
  message?: string;
}

function isBlockedDomain(domain: string, blocklist: string[]): boolean {
  return blocklist.some(
    (blocked) => domain === blocked || domain.endsWith('.' + blocked),
  );
}

export function validateSignupEmail(rawEmail: string): SignupEmailValidationResult {
  const email = (rawEmail || '').toLowerCase().trim();

  const invalidFormat: SignupEmailValidationResult = {
    valid: false,
    reason: 'format',
    message: SIGNUP_EMAIL_FORMAT_MESSAGE,
  };

  if (!email || email.length > 254) return invalidFormat;
  if (email.includes('..')) return invalidFormat;
  if (!EMAIL_FORMAT_REGEX.test(email)) return invalidFormat;

  const atIndex = email.lastIndexOf('@');
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (localPart.length > 64) return invalidFormat;

  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (RESERVED_TLDS.includes(tld)) {
    return { valid: false, reason: 'fake', message: SIGNUP_EMAIL_FAKE_MESSAGE };
  }

  if (isBlockedDomain(domain, DISPOSABLE_EMAIL_DOMAINS)) {
    return { valid: false, reason: 'disposable', message: SIGNUP_EMAIL_BLOCKED_MESSAGE };
  }

  if (isBlockedDomain(domain, FAKE_EMAIL_DOMAINS)) {
    return { valid: false, reason: 'fake', message: SIGNUP_EMAIL_FAKE_MESSAGE };
  }

  if (
    FAKE_LOCAL_PARTS.has(localPart) ||
    FAKE_LOCAL_PART_PATTERN.test(localPart) ||
    REPEATED_CHAR_LOCAL_PART.test(localPart)
  ) {
    return { valid: false, reason: 'fake', message: SIGNUP_EMAIL_FAKE_MESSAGE };
  }

  return { valid: true };
}
