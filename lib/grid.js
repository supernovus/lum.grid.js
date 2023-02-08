const core = require('@lumjs/core');
const {S,N,F,isObj} = core.types;
const {clone} = core.obj;

/**
 * Grid library.
 *
 * Inspired by GridList.js, but designed with my needs.
 *
 * @exports module:@lumjs/grid/grid
 */
class Grid
{
  constructor (options={}, defs={})
  {
    this._copySettings = [];

    // Default settings, can be overridden by the options.
    defs.minRows = 1;
    defs.maxRows = 0;
    defs.minCols = 1;
    defs.maxCols = 0;
    defs.fillMax = false;
    defs.conflictResolution = null;
    defs.resolutionOrder = null;
    this.applySettings(defs, options);

    core.observable(this, options.observable);

    // Create our items array.
    this.items = [];

    // Trigger for before we've initialized the grid.
    this.trigger('preInitialize', options);

    // Load any items that were passed in the constructor options.
    if ('items' in options)
    {
      const items = options.items;
      for (let i = 0; i < items.length; i++)
      {
        this.addItem(items[i], {add: false});
      }
    }

    // Initialize the grid.
    if (this.items.length > 0)
    {
      this.buildGrid();
    }
    else
    {
      this.resetGrid();
    }
    
    // Trigger for after we've initialized the grid.
    this.trigger('postInitialize', options);
  }

  clone ()
  {
    this.trigger('preClone', this.items, this.settings);
    const settings = clone(this.settings);
    // TODO: This predates the better clone() function; refactor it.
    for (const s in this._copySettings)
    {
      const setting = this._copySettings;
      settings[setting] = this.settings[setting];
    }
    settings.items = clone(this.items);
    this.trigger('postClone', this.items, this.settings);
    return new this.constructor(settings);
  }
  
  applySettings (settings, options)
  {
    if (this.settings === undefined)
      this.settings = {};

    for (var name in settings)
    {
      this.settings[name] 
        = name in options 
        ? options[name] 
        : settings[name];
    }
  }

  initRow (row, cols)
  {
    //console.debug("initRow", row, cols);
    if (!cols)
      cols = this.colCount();

    for (let i = 0; i < cols; i++)
    {
      if (row[i] === undefined)
      {
        row[i] = null;
      }
    }
  }

  addRow (rowCount)
  {
    //console.debug("addRow", rowCount);
    if (!rowCount)
      rowCount = this.rowCount(true);

    rowCount++;

    if (this.settings.maxRows && rowCount > this.settings.maxRows)
    {
      return false;
    }

    this.initGrid(rowCount, null);
    return true;
  }

  addCol (newCount)
  {
    if (!newCount)
      newCount = this.colCount(true);

    newCount++;

    if (this.settings.maxCols && newCount > this.settings.maxCols)
    {
      return false;
    }

    this.initGrid(null, newCount);
    return true;
  }

  rowCount (currentOnly)
  {
    if (currentOnly)
    {
      return this.grid.length;
    }
    else
    {
      if (this.settings.fillMax && this.settings.maxRows)
      {
        return this.settings.maxRows;
      }
      else if (this.grid.length > 0)
      {
        return this.grid.length;
      }
      else
      {
        return this.settings.minRows;
      }
    }
  }

  colCount (currentOnly)
  {
    if (currentOnly)
    {
      if (this.grid[0])
      {
        return this.grid[0].length;
      }
      return 0;
    }
    else
    {
      if (this.settings.fillMax && this.settings.maxCols)
      {
        return this.settings.maxCols;
      }
      else if (this.grid[0])
      {
        return this.grid[0].length;
      }
      else
      {
        return this.settings.minCols;
      }
    }
  }

  initGrid (rows, cols)
  {
    //console.debug("initGrid", rows, cols);
    if (!rows)
      rows = this.rowCount();
    //console.debug("initGrid.rows", rows);
    for (let i = 0; i < rows; i++)
    {
      if (this.grid[i] === undefined)
      {
        let row = [];
        this.grid[i] = row;
      }
      this.initRow(this.grid[i], cols);
    }
  }

  resetGrid ()
  {
    this.grid = [];
    this.initGrid();
  }

  buildGrid (addOpts)
  {
    this.trigger('preBuildGrid', this.grid)
    this.resetGrid();
    for (let i = 0; i < this.items.length; i++)
    {
      this.addToGrid(this.items[i], addOpts);
    }
    this.trigger('postBuildGrid', this.grid);
  }

  addToGrid (item, opts)
  {
    //console.debug("addToGrid", item, opts);
    const set = this.settings;

    const cr = this.getConflictResolution();
    let postConflict = false;
    let conflicts = null;

    if ('x' in item && 'y' in item)
    {
      conflicts = this.itemFits(item);
      if (cr && cr.addFirst)
      {
        postConflict = true;
      }
      else if (conflicts !== true && 
        !this.resolveConflicts(item, conflicts, opts))
      {
        return false;
      }
    }
    else if (!this.findEmptyPosition(item, opts))
    {
      return false;
    }

    // If we reached here, we can save the item to the grid.
    for (let y = item.y; y < item.y + item.h; y++)
    {
      if (this.grid[y] === undefined)
      {
        //console.debug("Adding row", y);
        if (!this.addRow(y))
        {
          console.error("Adding row failed", y, this);
          return false;
        }
      }
      for (let x = item.x; x < item.x + item.w; x++)
      {
        //console.debug("adding item", item, y, x);
        if (this.grid[y][x] === undefined)
        {
          //console.debug("Adding col", x);
          if (!this.addCol(x))
          {
            console.error("Adding col failed", x, this);
            return false;
          }
        }
        this.grid[y][x] = item;
      }
    }

    if (postConflict)
    { // We'll try to resolve all conflicts after adding the item to the grid.
      if (conflicts !== true && conflicts !== null && 
        !this.resolveConflicts(item, conflicts, opts))
      {
        console.error("Post-placement conflict resolution encountered errors.", item, opts);
      }
    }

    return true;
  }

  itemFits (item, pos={})
  {
    if (pos.x === undefined)
    {
      pos.x = (item.x !== undefined ? item.x : 0);
    }
    if (pos.y === undefined)
    {
      pos.y = (item.y !== undefined ? item.y : 0);
    }

    if (pos.x < 0 || pos.y < 0)
    { // No negatives.
      return false;
    }

    if (this.settings.maxRows && pos.y + item.h > this.settings.maxRows)
    { // Cannot exceed maximum rows.
      return false;
    }

    if (this.settings.maxCols && pos.x + item.w > this.settings.maxCols)
    { // Cannot exceed maximum cols.
      return false;
    }

    const conflicts = [];

    for (let y = pos.y; y < pos.y + item.h; y++)
    {
      const row = this.grid[y];
      if (!row) continue; // Non-defined row.
      for (let x = pos.x; x < pos.x + item.w; x++)
      {
        const col = row[x];
        if (col)
        {
          if (col === item) continue; // Skip the item itself.
          if (col.id !== undefined && item.id !== undefined 
            && col.id === item.id) continue; // Skip an item with the same id.
          if (conflicts.indexOf(col) === -1)
          {
            conflicts.push(col);
          }
        }
      }
    }

    if (conflicts.length > 0)
    {
      if (pos.conflicts === false)
        return false;
      return conflicts;
    }

    return true;
  }

  findEmptyPosition (item, opts={})
  {
    const set = this.settings;
    const starty = opts.startY ?? (item.y ?? 0);
    const startx = opts.startX ?? (item.x ?? 0);
    const endy = opts.endY ?? (set.maxRows ?? (this.rowCount() + 1));
    const endx = opts.endX ?? (set.maxCols ?? (this.colCount() + 1));

    if (opts.reverse)
    {
      return this._find_empty_reverse(starty, endy, startx, endx, item, opts);
    }
    else
    {
      return this._find_empty_forward(starty, endy, startx, endx, item, opts);
    }
  }

  _find_empty_forward (starty, endy, startx, endx, item, opts)
  {
    for (let y = starty; y < endy; y++)
    {
      for (let x = startx; x < endx; x++)
      {
        const fits = this.itemFits(item, {x: x, y: y});
        if (fits === true)
        { // The item fits at this position.
          return this._found_empty(y, x, item, opts);
        }
        else if (startx != endx && Array.isArray(fits))
        { // Skip the width of the first conflicting item.
          x += (fits[0].w - 1);
        }
      }
    }
    return false;
  }

  _find_empty_reverse (starty, endy, startx, endx, item, opts)
  {
    for (let y = endy; y >= starty; y--)
    {
      for (let x = endx; x >= startx; x--)
      {
        const fits = this.itemFits(item, {x: x, y: y});
        if (fits === true)
        { // The item fits at this position.
          return this._found_empty(y, x, item, opts);
        }
        else if (startx != endx && Array.isArray(fits))
        { // Skip the width of the first conflicting item.
          x -= fits[0].w;
        }
      }
    }
    return false;
  }

  _found_empty (y, x, item, opts)
  {
    //console.debug("found_empty", y, x, item, opts);
    if (opts.returnPos)
    { // Return the position we fit at.
      return {x: x, y: y};
    }
    else
    { // Update the item position, and return true.
      item.x = x;
      item.y = y;
      return true;
    }
  }

  _find_empty_horizontal (item, opts={})
  {
    if (item.x === undefined || item.y === undefined)
      return false; // Cannot use with an item that doesn't have coords.
    if (opts.reverse)
    {
      opts.startX = 0;
      opts.endX = item.y;
    }
    else
    {
      opts.startX = item.x;
      opts.endX   = this.settings.maxCols !== undefined
        ? this.settings.maxCols
        : this.colCount() + 1;
    }
    opts.startY = item.y;
    opts.endY   = item.y;
    return this.findEmptyPosition(item, opts);
  }

  _find_empty_vertical (item, opts={})
  {
    if (item.x === undefined || item.y === undefined)
      return false; // Cannot use with an item that doesn't have coords.
    if (opts.reverse)
    {
      opts.startY = 0;
      opts.endY = item.y;
    }
    else
    {
      opts.startY = item.y;
      opts.endY   = this.settings.maxRows !== undefined
        ? this.settings.maxRows
        : this.rowCount() + 1;
    }
    opts.startX = item.x;
    opts.endX   = item.x;
    return this.findEmptyPosition(item, opts);
  }

  findEmptyToLeft (item, opts={})
  {
    opts.reverse = true;
    return this._find_empty_horizontal(item, opts);
  }

  findEmptyToRight (item, opts={})
  {
    opts.reverse = false;
    return this._find_empty_horizontal(item, opts);
  }

  findEmptyAbove (item, opts={})
  {
    opts.reverse = true;
    return this._find_empty_vertical(item, opts);
  }

  findEmptyBelow (item, opts={})
  {
    opts.reverse = false;
    return this._find_empty_vertical(item, opts);
  }

  sortItems ()
  {
    this.items.sort(function (item1, item2)
    {
      if (item1.y != item2.y)
      {
        return item1.y - item2.y;
      }
      if (item1.x != item2.x)
      {
        return item1.x - item2.x;
      }
      return 0;
    }.bind(this));
  }

  removeFromGrid (item, opts)
  {
    for (let y = item.y; y < item.y + item.h; y++)
    {
      if (!this.grid[y]) continue; // Not found in grid.
      for (let x = item.x; x < item.x + item.w; x++)
      {
        if (this.grid[y][x] === item)
        {
          this.grid[y][x] = null;
        }
      }
    }
  }

  getConflictResolution ()
  {
    const meth = this.settings.conflictResolution;
    //console.debug("getConflictResolution", meth);
    if (typeof meth === S)
    {
      return this.resolveConflicts[meth];
    }
  }

  /**
   * Use our configured conflict resolution method.
   */
  resolveConflicts (item, conflicts, opts={})
  {
    //console.debug("resolveConflicts", item, conflicts, opts);
    if (conflicts === true)
    {
      return true;
    }

    // Force the returnPos to be false.
    opts.returnPos = false;

    // Pass it off onto the conflict resolution method.
    const meth = this.getConflictResolution();
    if (typeof meth === F)
    {
      return meth.call(this, item, conflicts, opts);
    }
    else
    {
      return false;
    }
  }

  resolutionOrder ()
  {
    const valid = ['l','r','u','d'];
    const resOrder = this.settings.resolutionOrder;
    if (resOrder !== null && $.isArray(resOrder))
    { // A custom order was specified.
      const order = [];
      for (let o = 0; o < resOrder.length; o++)
      {
        const dir = resOrder[o].substr(0,1).toLowerCase();
        if (valid.indexOf(dir) !== -1 && order.indexOf(dir) === -1)
        {
          order.push(dir);
        }
      }
      if (order.length > 0)
      {
        return order;
      }
      else
      {
        console.error("Invalid order specified", resOrder, "using default.");
        return valid;
      }
    }
    else
    { // Use the default.
      return valid;
    }
  }

  addItem (item, options={})
  {
    this.trigger('preAddItem', item, options);
    this.items.push(item);
    if (options.rebuild)
      this.buildGrid(options);
    else if (options.add !== false)
      this.addToGrid(item, options);
    this.trigger('postAddItem', item, options);
    this.trigger('changed');
  }

  removeItem (item, options={})
  {
    this.trigger('preRemoveItem', item, options);
    const offset = this.items.indexOf(item);
    this.items.splice(offset, 1);
    if (options.rebuild)
      this.buildGrid(options);
    else if (options.remove !== false)
      this.removeFromGrid(item, options);
    this.trigger('postRemoveItem', item, options);
    this.trigger('changed');
  }

  moveItem (item, newpos, options={})
  {
    this.removeFromGrid(item, options);
    if (isObj(newpos) && typeof newpos.x === N && typeof newpos.y === N)
    {
      item.x = newpos.x;
      item.y = newpos.y;
    }
    this.addToGrid(item, options);
    this.trigger('changed');
  }

  resizeItem (item, newdim, options)
  {
    this.removeFromGrid(item, options);
    if (isObj(newdim) && typeof newdim.w === N && typeof newdim.h === N)
    {
      item.w = newdim.w;
      item.h = newdim.h;
    }
    this.addToGrid(item, options);
    this.trigger('changed');
  }

} // class Grid

module.exports = Grid;
