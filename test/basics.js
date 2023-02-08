// Basic tests

const plan = 5;
const t = require('@lumjs/tests').new({module, plan});
const core = require('@lumjs/core');
const {F,O,isComplex} = core.types;
const Grid = require('../lib');

t.isa(Grid, [F], 'Grid is a function');

if (isComplex(Grid))
{
  const GP = Grid.prototype;
  t.isa(GP, [O], 'Grid.prototype is an object');
  if (isComplex(GP))
  {
    const RC = GP.resolveConflicts;
    t.isa(RC, [F], 'Grid#resolveConflicts is a function');
    if (isComplex(RC))
    {
      t.isa(RC.findEmpty, [F], '...findEmpty is a function');
      t.isa(RC.moveConflicting, [F], '...moveConflicting is a function');
    }
  }
}

// TODO: other tests

// All done.
t.done();

