import { describe, expect, it } from 'vitest';
import { vanilla, withMods } from './helpers';

const load = (text: string, name = 'poptype-test.dm') => withMods([{ name, text }]);
const msgs = (DMI: any) => DMI.modMessages.map((x: any) => `${x.level}@${x.line}: ${x.msg}`);

describe('poptypes', () => {
  it('vanilla load has only the generated vanilla poptypes, unmodded, and no errors', async () => {
    const DMI = await vanilla();
    expect(DMI.modctx.poptypedata.length).toBe(82);
    expect(DMI.modctx.poptypedata.every((p: any) => !p.modded && !p.modfiles)).toBe(true);
    expect(DMI.modMessages).toEqual([]);
    expect(DMI.errors).toEqual([]);
  });

  it('creates a new poptype with recruit units and commanders (ids and names)', async () => {
    const DMI = await load(`#modname "Pop"
#selectpoptype 12
#addrecunit 89
#addrecunit 89
#addreccom "Warlock"
#addreccom 92
#end
`);
    expect(msgs(DMI)).toEqual([]);
    const p = DMI.modctx.poptypelookup[12];
    expect(DMI.modctx.poptypedata.filter((x: any) => x.modded)).toEqual([p]);
    expect(p.id).toBe(12);
    expect(p.recunits).toEqual([89, 89]); // order and duplicates are kept
    expect(p.reccoms).toEqual([parseInt(DMI.modctx.unitlookup['warlock'].id), 92]);
    expect(p.pd).toEqual([]);
    expect(p.modded).toBe(true);
    expect(p.modfiles).toEqual(['poptype-test.dm']);
  });

  it('reselecting an id edits the same entry and records every touching mod file', async () => {
    const DMI = await withMods([
      { name: 'a.dm', text: '#selectpoptype 3\n#addrecunit 1\n#end\n' },
      { name: 'b.dm', text: '#selectpoptype 3\n#addrecunit 2\n#end\n#selectpoptype 4\n#end\n' },
    ]);
    expect(DMI.modctx.poptypedata.filter((x: any) => x.modded).length).toBe(2);
    expect(DMI.modctx.poptypelookup[3].recunits).toEqual([1, 2]);
    expect(DMI.modctx.poptypelookup[3].modfiles).toEqual(['a.dm', 'b.dm']);
    expect(DMI.modctx.poptypelookup[4].modfiles).toEqual(['b.dm']);
  });

  it('keeps province defence pairs in order, replacing the first pair with the same key', async () => {
    const DMI = await load(`#selectpoptype 7
#defunit1 89
#defmult1 3
#defunit1b 92
#defmult1b 2
#defcom1 5
#defunit1 90
#defmult1 4
#end
`);
    expect(msgs(DMI)).toEqual([]);
    expect(DMI.modctx.poptypelookup[7].pd).toEqual([
      ['defunit1', 90],
      ['defmult1', 4],
      ['defunit1b', 92],
      ['defmult1b', 2],
      ['defcom1', 5],
    ]);
  });

  it('clearrec empties recruit units and commanders, cleardef empties the defence list', async () => {
    const DMI = await load(`#selectpoptype 20
#addrecunit 89
#addreccom 92
#defunit1 89
#defmult1 2
#clearrec
#end
#selectpoptype 20
#addrecunit 90
#cleardef
#defunit1b 91
#end
`);
    expect(msgs(DMI)).toEqual([]);
    const p = DMI.modctx.poptypelookup[20];
    expect(p.recunits).toEqual([90]);
    expect(p.reccoms).toEqual([]);
    expect(p.pd).toEqual([['defunit1b', 91]]);
  });

  it('rejects ids outside 0-249 and unknown unit names, leaving no entry behind', async () => {
    const DMI = await load(`#selectpoptype 250
#addrecunit 89
#end
#selectpoptype -1
#selectpoptype 249
#addrecunit "no such unit"
#end
#selectpoptype 0
#end
`);
    const m = msgs(DMI);
    expect(m).toContain('error@1: poptype id out of range (0-249)');
    expect(m).toContain('error@4: poptype id out of range (0-249)');
    expect(m).toContain('error@6: unit not found');
    expect(DMI.modctx.poptypedata.filter((p: any) => p.modded).map((p: any) => p.id)).toEqual([249, 0]);
  });

  it('only poptype commands are accepted inside a poptype block', async () => {
    const DMI = await load('#selectpoptype 1\n#gcost 5\n#addrecunit 89\n#end\n');
    expect(msgs(DMI)).toEqual(['error@2: command not found for poptype']);
    expect(DMI.modctx.poptypelookup[1].recunits).toEqual([89]);
  });
});
