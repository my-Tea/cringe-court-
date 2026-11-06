import { describe, expect, it } from 'vitest';
import { describeHits, redact, type RedactionKind } from '../redact';

const kinds = (s: string) => redact(s).hits.map((h) => h.kind);

describe('redact', () => {
  it('removes emails', () => {
    const r = redact('mail me at jane.doe+x@example.co.uk please');
    expect(r.text).toBe('mail me at [email removed] please');
    expect(r.hits).toEqual([{ kind: 'email', match: 'jane.doe+x@example.co.uk' }]);
  });

  it('removes http(s), www and bare-domain URLs', () => {
    expect(redact('see https://example.com/a?b=1 now').text).toBe('see [link removed] now');
    expect(redact('see http://foo.bar/baz now').text).toBe('see [link removed] now');
    expect(redact('see www.somewhere.net/x now').text).toBe('see [link removed] now');
    expect(redact('find me on insta.gg/pics').text).toBe('find me on [link removed]');
    expect(redact('visit dumplings.com today').text).toBe('visit [link removed] today');
    expect(kinds('visit dumplings.com')).toEqual(['url']);
  });

  it('removes wallet addresses (0x + 40 hex)', () => {
    const w = `0x${'aB'.repeat(20)}`;
    const r = redact(`send to ${w} thanks`);
    expect(r.text).toBe('send to [wallet removed] thanks');
    expect(r.hits[0]).toEqual({ kind: 'wallet', match: w });
  });

  it('does not treat a 0x string of the wrong length as a wallet', () => {
    expect(kinds(`0x${'a'.repeat(39)}`)).not.toContain('wallet');
  });

  it('removes ENS names', () => {
    const r = redact('i am vitalik.eth on chain');
    expect(r.text).toBe('i am [name removed] on chain');
    expect(r.hits).toEqual([{ kind: 'ens', match: 'vitalik.eth' }]);
  });

  it('removes @handles but keeps the leading character', () => {
    expect(redact('follow @sir_loin now').text).toBe('follow [handle removed] now');
    expect(redact('@sir_loin started it').text).toBe('[handle removed] started it');
    expect(redact('(@a_b) did it').text).toBe('([handle removed]) did it');
  });

  it('does not report an email as a handle', () => {
    expect(kinds('x@y.com')).toEqual(['email']);
    expect(kinds('a.b@c.org and d@e.io')).toEqual(['email', 'email']);
  });

  it('removes phone numbers in several formats', () => {
    for (const phone of ['555-123-4567', '555 123 4567', '555.123.4567', '(555) 123-4567', '+1 555-123-4567', '+44 7700 9001']) {
      const r = redact(`call ${phone} tonight`);
      expect(r.text, phone).toBe('call [number removed] tonight');
      expect(r.hits.map((h) => h.kind)).toEqual(['phone']);
    }
  });

  // Regression: the phone rule used to stop at 4 digits in the last group.
  it('removes international numbers with a six-digit tail', () => {
    expect(redact('call +44 7700 900123 tonight').text).not.toContain('900123');
  });

  it('removes long digit runs', () => {
    const r = redact('card 4111111111111111 ok');
    expect(r.text).toBe('card [number removed] ok');
    expect(r.hits).toEqual([{ kind: 'number', match: '4111111111111111' }]);
  });

  it('leaves short numbers and ordinary prose alone', () => {
    for (const text of ['We split 50/50 at 7pm, 3 dumplings each.', 'It cost $12.50 and took 45 minutes.', 'Pineapple on pizza is a crime. Fight me.', '']) {
      const r = redact(text);
      expect(r.text).toBe(text);
      expect(r.hits).toEqual([]);
    }
  });

  it('handles several kinds in one text', () => {
    const r = redact('Email a@b.com, call 555-123-4567, or @bob. Or visit www.x.org');
    expect(new Set(r.hits.map((h) => h.kind))).toEqual(new Set<RedactionKind>(['email', 'phone', 'handle', 'url']));
    expect(r.text).not.toMatch(/a@b\.com|555|@bob|www\./);
  });
});

describe('describeHits', () => {
  const hit = (kind: RedactionKind) => ({ kind, match: 'x' });

  it('says nothing needed removing for no hits', () => {
    expect(describeHits([])).toBe('Nothing needed removing.');
  });

  it('uses singular and plural labels', () => {
    expect(describeHits([hit('url')])).toBe('Removed 1 link.');
    expect(describeHits([hit('phone'), hit('phone')])).toBe('Removed 2 phone numbers.');
  });

  it('joins with commas and "and"', () => {
    expect(describeHits([hit('phone'), hit('phone'), hit('url')])).toBe('Removed 2 phone numbers and 1 link.');
    expect(describeHits([hit('email'), hit('url'), hit('handle')])).toBe('Removed 1 email address, 1 link and 1 social handle.');
  });

  it('describes real redactions end to end', () => {
    expect(describeHits(redact('mail a@b.com or c@d.com').hits)).toBe('Removed 2 email addresss.');
  });
});
