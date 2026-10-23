import { describe, expect, it } from 'vitest';
import { vanilla } from './helpers';
import { renderEventCard, opcodeLabel } from '../src/ui/eventCard';

const card = async (id: number) => {
  const DMI = await vanilla();
  const o = DMI.modctx.eventlookup[id];
  return { DMI, o, html: renderEventCard(DMI, o) as string };
};
/** The visible text of a html fragment (tags and database-key spans removed). */
const text = (html: string) => html.replace(/<span class="internal-inline">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
const mapOf = (html: string) => html.slice(html.indexOf('<section class="evc-map"'));

describe('event card', () => {
  it('1772 Mage King legend: chain start', async () => {
    const { html } = await card(1772);
    expect(html).toContain('<div class="h2replace">Local legends speak of a great Mage King that once ruled these lands</div>');
    expect(html).toContain('evc-kind-good">common good</span>');
    expect(text(html)).toContain('story events: Minor or All story events');
    expect(text(html)).toContain('province code: none (starts a chain)');
    expect(text(html)).toContain('province code: set to 135');
    const map = mapOf(html);
    expect(map).toContain('Storyline:');
    expect(text(map)).toContain('Leads to · same province code 135');
    for (const id of [1773, 1775, 1776]) expect(map).toContain(`<a class="ref" data-ref="event ${id}">`);
    expect(map).toContain('data-ref="event 1774"'); // second hop
    expect(map).toContain('evc-node evc-kind-good evc-cur');
  });

  it('1773: inherits the story requirement and links back', async () => {
    const { html } = await card(1773);
    expect(text(html)).toMatch(/story events: Minor or All story events inherited from storyline: Local legends/);
    const map = mapOf(html);
    expect(map).toContain('data-ref="event 1772"');
    expect(text(map)).toContain('sets code 135');
    expect(text(map)).toContain('Astral 3+ mage');
    // the legacy code-link rows are replaced by the story map
    expect(html).not.toContain('linkedReqCodes');
  });

  it('3200 arena: global badge, world flag, delayed follow-up', async () => {
    const { html } = await card(3200);
    expect(html).toContain('evc-kind-global">special global</span>');
    expect(html).toContain('<div class="h2replace">A death match competition is scheduled in the arena</div>');
    expect(text(html)).toContain('needs no arena death match');
    expect(text(html)).toMatch(/next event: The death match competition is taking place #3201, after 1 turn/);
    expect(text(mapOf(html))).toContain('1 turn later');
    expect(mapOf(html)).toContain('data-ref="event 3201"');
  });

  it('0 festival: standalone, no story rows, no map', async () => {
    const { html } = await card(0);
    expect(html).toContain('<div class="h2replace">A festival was held in the honor of the God</div>');
    expect(html).toContain('evc-kind-good">common good</span>');
    expect(html).not.toContain('evc-map');
    expect(html).not.toContain('req_story');
  });

  it('req_9600 is shown as a chance', async () => {
    const { o, html } = await card(416);
    expect(o.req_9600).toBe('50');
    expect(text(html)).toContain('chance: 50% chance');
    expect(html).not.toContain('req_9600');
    expect(text(mapOf(html))).toContain('50% chance');
  });

  it('labels unknown and uncertain opcodes', async () => {
    expect(opcodeLabel('7200')).toBe('0x72');
    expect(opcodeLabel('0601')).toBe('0x106');
    expect(text((await card(274)).html)).toContain('unknown command 0x72: 9');
    const { html } = await card(3176);
    expect(html).toMatch(/<tr class="req_cataclysmturn [^"]*evc-guess" title="Opcode 0x63 identified as cataclysmturn with medium confidence"> <th>≈ turn relative to cataclysm/);
  });

  it('caps long successor lists', async () => {
    const { html } = await card(2518);
    expect(html).toMatch(/<summary>\+\d+ more<\/summary>/);
  });

  it('renders every event without raw opcode labels, and leaves renderOverlay untouched', async () => {
    const DMI = await vanilla();
    const bad: string[] = [];
    for (const o of DMI.modctx.eventdata) {
      const before = o.renderOverlay(o);
      const html = renderEventCard(DMI, o);
      if (/req_[0-9A-F]{4}:|>[0-9A-F]{4}: </.test(text(html))) bad.push(String(o.id));
      if (o.renderOverlay(o) !== before) bad.push(o.id + ' (overlay changed)');
    }
    expect(bad).toEqual([]);
  });
});
