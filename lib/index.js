/**
 * A basic Grid class with pre-defined conflict resolvers added.
 * @module module:@lumjs/grid
 * @see module:@lumjs/grid/grid
 * @see module:@lumjs/grid/resolvers
 */

const Resolvers = require('./resolvers');
module.exports = Resolvers.registerAll().Grid;
