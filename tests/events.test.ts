import { describe, expect, it } from 'vitest';
import { eventTitle } from '../src/data/extensions/events';
import { vanilla, withMods } from './helpers';

const ev = async (id: number) => (await vanilla()).modctx.eventlookup[id].ev;

describe('event model', () => {
  it('names opcode tokens', async () => {
    const DMI = await vanilla();
    const withRare = DMI.modctx.eventdata.find((o: any) => o.req_9600 !== undefined);
    expect(withRare.ev.reqs.rare).toEqual([String(withRare.req_9600)]);
    expect(withRare.ev.chance).toBe(parseInt(withRare.req_9600, 10));
    expect(withRare.ev.reqs['9600']).toBeUndefined();
  });

  it('builds readable titles', () => {
    expect(eventTitle('A festival was held in the honor of ##godname##. Everyone was celebrating.')).toBe(
      'A festival was held in the honor of the God',
    );
    expect(eventTitle('Strange lights were seen. [Volcano]')).toBe('Strange lights were seen');
  });

  it('classifies rarity', async () => {
    expect((await ev(0)).kind).toBe('good');
    expect((await ev(3200)).kind).toBe('global');
  });

  it('links a chain and gives roles', async () => {
    const start = await ev(1772);
    expect(start.role).toBe('start');
    expect(start.next.map((l: any) => l.id)).toContain(1773);
    const mid = await ev(1773);
    expect(mid.prev.map((l: any) => l.id)).toContain(1772);
    expect(mid.storyline).toBe(start.storyline);
  });

  it('follows delays to the next event id', async () => {
    expect((await ev(3200)).next).toContainEqual({ id: 3201, via: 'delay', turns: 1 });
  });

  it('inherits story level through a chain', async () => {
    const start = await ev(1772);
    expect(start.storyEffective).toBeGreaterThan(0);
    expect((await ev(1773)).story).toBe(0);
    expect((await ev(1773)).storyEffective).toBe(start.storyEffective);
    expect((await ev(0)).storyEffective).toBe(0);
  });

  it('keeps shared world-state codes out of storylines', async () => {
    const DMI = await vanilla();
    expect(DMI.eventWorldFlags.has(-44)).toBe(true);
    const sizes = DMI.eventStorylines.map((s: any) => s.events.length);
    expect(Math.max(...sizes)).toBeLessThan(100);
  });

  it('is not an enumerable field (golden parity)', async () => {
    const DMI = await vanilla();
    expect(Object.keys(DMI.modctx.eventlookup[0])).not.toContain('ev');
  });

  it('handles modded events', async () => {
    const DMI = await withMods([
      {
        name: 'ev.dm',
        text: '#newevent\n#rarity -1\n#req_rare 25\n#req_story 2\n#msg "A modded wonder. [Nowhere]"\n#code -900\n#end\n',
      },
    ]);
    const o = DMI.modctx.eventdata.find((e: any) => e.ev?.title === 'A modded wonder');
    expect(o.ev.chance).toBe(25);
    expect(o.ev.story).toBe(2);
  });
});
