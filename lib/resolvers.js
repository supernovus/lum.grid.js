const core = require('@lumjs/core');
const {def,F,S,needType} = core.types;

/**
 * Default set of conflict resolution methods.
 * @module module:@lumjs/grid/resolvers
 */

/**
 * The actual method definitions.
 * They will be *copied* from here to the `Grid.prototype.resolveConflicts`
 * @alias module@lumjs/grid/resolvers.methods
 */
const rcm = exports.methods = {}

/**
 * Use findEmptyPosition() to find an available space.
 */
rcm.findEmpty = function (item, conflicts, opts)
{
  return this.findEmptyPosition(item, opts);
}

/**
 * A simplistic form of non-cascading item shuffling.
 * it will fall back on @findEmpty@ if it fails.
 *
 * It tries shifting conflicts left, right, above, below, in that order.
 * If all of those fail, it moves the conflicts to an empty position.
 */
rcm.moveConflicting = function (item, conflicts, opts)
{
//    console.debug("moveConflicting", item, conflicts, opts);
  if (conflicts === false)
  { // No conflicts, try to find an optimal position for the item.
    // TODO: try shifting desired position just a little.
    return this.findEmptyPosition(item, opts);
  }

  var fallback = opts.fallback !== undefined ? opts.fallback : true;
  var order = this.resolutionOrder();
  var meths =
  {
    l: 'findEmptyToLeft',
    r: 'findEmptyToRight',
    u: 'findEmptyAbove',
    d: 'findEmptyBelow',
  };

  resolve: for (var c in conflicts)
  {
    var citem = conflicts[c];
    for (var o = 0; o < order.length; o++)
    {
      var mname = order[o];
      var meth = meths[mname];
      if (meth && this[meth](citem, opts))
      { // We successfully resolved.
        this.moveItem(citem);
        continue resolve;
      }
    }

    // If we reached here, none of the above worked.
    if (fallback)
    {
      if (this.findEmptyPosition(citem, opts))
      { // We moved the item with findEmptyPosition()
        this.moveItem(citem);
      }
      else
      { // We couldn't move this item at all.
        // This shouldn't happen unless the whole grid is full.
        return false;
      }
    }
    else
    { // No fallback, we return false immediately.
      return false;
    }
  }

  // If we reached here, all conflicts were resolved.
  return true;
}
rcm.moveConflicting.addFirst = true;

/**
 * Set up a collection of resolvers.
 * 
 * @param {object} res - Must have an inner object called `methods`.
 * @returns {object} `res`
 */
function setupResolvers(res)
{
  /**
   * A magic `Grid` property that will auto-load the Grid class if needed.
   */
  def(res, 'Grid', 
  {
    get()
    {
      if (this.$GridClass === undefined)
      {
        this.$GridClass = require('./grid');
      }
      return this.$GridClass;
    },
    set(gridClass)
    {
      if (typeof gridClass === F)
      {
        this.$GridClass = gridClass;
      }
    }
  });

  /**
   * Register a conflict resolver method.
   * 
   * @param {string} fn - The method to register
   * @param {object} [Grid] The Grid class to add it to. 
   */
  res.register = function(fn, Grid)
  {
    needType(S, fn, 'fn must be a method name string');
    needType(F, rcm[fn], `${fn} is not a known conflict resolution function`);

    if (typeof Grid === F)
      this.Grid = Grid;    
    else 
      Grid = this.Grid;

    const grc = Grid.prototype.resolveConflicts;

    grc[fn] = rcm[fn];

    return this;
  }

  res.registerAll = function(Grid)
  {
    if (typeof Grid === F)
      this.Grid = Grid;

    for (const fn in this.methods)
    {
      this.register(fn);
    }

    return this;
  }

  // Don't think about it too much...
  res.setupResolvers = setupResolvers;

  return res;
}

// Now call it.
setupResolvers(exports);
