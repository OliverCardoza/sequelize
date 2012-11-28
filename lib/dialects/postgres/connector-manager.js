var Query   = require("./query")
  , Utils   = require("../../utils")
  , pg      = require("pg").native
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem }) }

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.config = config || {}
    this.pooling = (this.config.pool != null && this.config.pool.maxConnections > 0)
    this.uri = this.config.uri || this.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(this.config)
    if (this.pooling) {
      pg.defaults.poolSize = this.config.pool.maxConnections
      pg.defaults.poolIdleTimeout = this.config.pool.maxIdleTime
    } else {
      this.client = new pg.Client(this.uri)
    }

    process.on('exit', function() {
      if(this.pooling) {
        pg.end(this.uri) // Disconnect all connections in pool
      } else {
        this.disconnect()
      }
    }.bind(this));
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  function connect(callback) {
    if (this.pooling) {
      pg.connect(this.uri, callback)
    } else {
      // Not part of the public pg API, so beware on pg upgrades.
      if(this.client._connected) {
        callback(null, this.client)
      } else {
        this.client.connect(function(err) {
          if(err) return callback(err)
          callback(null, this.client)
        }.bind(this))
      }
    }
  }

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var query = new Query(connect.bind(this), this.sequelize, callee, options || {})
    return query.run(sql)
  }

  ConnectorManager.prototype.disconnect = function() {
    this.client.end()
  }

  return ConnectorManager
})()
