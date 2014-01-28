var q = require('q')
	, mysql = require('mysql');

(function () {

	/*
	** Helpers
	*/

	/* Borrowed from moment.js */
	function extend(a, b) {
    for (var i in b) {
        if (b.hasOwnProperty(i)) {
            a[i] = b[i];
        }
    }

    if (b.hasOwnProperty("toString")) {
        a.toString = b.toString;
    }

    if (b.hasOwnProperty("valueOf")) {
        a.valueOf = b.valueOf;
    }

    return a;
	}

	function checkOptions ( options ) {
		var valid = true
			, reason = "";

		if(!options.db) {
			valid = false;
			reason += "You must provide the name of the database to use\n";
		}
		if(!options.user) {
			valid = false;
			reason += "You must provide the database username\n";
		}
		if(!options.pass) {
			valid = false;
			reason += "You must provide the database user\'s password\n";
		}

		if(!options.host) {
			 valid = false;
			 reason += "You must provide the database host\n";
		}

		return {
			valid : valid,
			reason: reason
		};
	}

	function search ( collection, criteria ) {
		var match;
		collection.forEach(function ( item ) {
			//this one is a match until proven otherwise
			match = item;
			console.log('collection: ', collection);
			for (var criteriaKey in criteria) {
				if(criteria.hasOwnProperty(criteriaKey)) {
					console.log('criteria key: ', criteriaKey, 'criteriaValue: ', criteria[criteriaKey]);
					if(typeof item[criteriaKey] === 'undefined') { match = null; }
					if(item[criteriaKey] != criteria[criteriaKey]) { match = null; }
				}
			}
		});
		return match;
	}

	function createQuery ( tableName, options, mappings ) {
		var sql = "select "
			, parameters = [];
		if(!!options.columns) {
			for(var columnName in options.columns) {
				if(options.columns.hasOwnProperty(columnName)) {
					sql += columnName + ',';
				}
			}
			//remove trailing comma
			sql = sql.substr(0, sql.length - 2) + " ";
		} else {
			sql += "* "
		}
		sql += "from " + tableName;
		if(!!options.criteria) {
			sql += " where ";

			var count = 0;
			for (var key in options.criteria) {
				if(options.criteria.hasOwnProperty(key)) {
					//add the parameter
					parameters.push(options.criteria[key]);
					
					if(typeof	mappings === 'undefined') {
						sql += key + '= ?';	
					} else {
						sql += mappings[key] + '= ?';
					}
					
					count++;
					if(count < options.criteria.length) {
						sql += " and";
					}
				}
			}
			console.log('sql after criteria: ', sql);
		}

		if(!!options.orderBy) {
			parameters.push(options.orderBy);
			if(typeof mappings === 'undefined' || !mappings[options.orderBy]) {
				sql += " order by " + options.orderBy;
			} else {
				sql += " order by " + mappings[options.orderBy];
			}
		}

		return {
			sql : sql,
			parameters : parameters
		};
	}

	function _query ( connection, classToQuery, options ) {
		var resultQuery = createQuery(classToQuery.table, options, classToQuery.mappings);

		var deferred = q.defer();
		connection.query(resultQuery.sql, resultQuery.parameters, function ( err, rows, columns ) {
			if(err) {
				return deferred.reject(err);
			}
			deferred.resolve(rows);
		});
		return deferred.promise.then(function ( mysqlResult ) {
			return classToQuery.construct(mysqlResult);
		});
	}

	function Instance ( row, mappings ) {
		var self = this;
		if(typeof mappings === 'undefined') {
			for(var column in row) {
				if(row.hasOwnProperty(column)) {
					self[column] = row[column];
				}
			}
		} else {
			for(var column in row) {
				if(row.hasOwnProperty(column)) {
					for(var mappingKey in mappings) {
						if(mappings.hasOwnProperty(mappingKey)) {
							var mysqlColumn = mappings[mappingKey];
							self[mappingKey] = row[mysqlColumn];
						}
					}
				}
			}
		}
	}

	function Class ( name, options ) {
		this.table = options.table;
		this.name = name;
		
		if(!!options.mappings) {
			this.mappings = options.mappings;
		}

		var self = this;

		//construct object without internal properties like 'table'
		this.construct = function ( mysqlResult ) {
			if(!mysqlResult || !mysqlResult.length > 0) {
				return null;	
			}

			if(mysqlResult.length === 1) {
				return new Instance(mysqlResult[0], self.mappings);
			}

			var instanceArray = [];
			mysqlResult.forEach(function ( row ) {
				instanceArray.push(new Instance(row, self.mappings));
			});

			return instanceArray;
		}
	}

	function Minimap () {
		var self = this;
		this._classes = [];

		this.init = function ( options ) {
			var validator = checkOptions(options);
			if(validator.valid === false) {
				throw new Error(validator.reason);
			}

			self.db = options.db;
			self.user = options.user;
			self.pass = options.pass;
			self.host = options.host;
			self.connection = mysql.createConnection({
				host : options.host,
  			database : options.db,
  			user : options.user,
  			timezone:"Z",
  			password : options.pass,
  			multipleStatements: true,
  			wait_timeout : 1000,
  			debug : false
			});
		};

		this.define = function ( objectName, options ) {
			self._classes.push(new Class(objectName, options));	
		}

		this.query = function ( className, options ) {
			var classToQuery = search(self._classes, {
				name : className
			});
			if(!classToQuery) { throw new Error('Class "' + className + '" not found'); }
			return _query(self.connection, classToQuery, options);
		}

		this.all = function ( className, options ) {
			var classToQuery = search(self._classes, {
				name : className
			});

			if(!classToQuery) { throw new Error('Class "' + className + '" not found'); }
			
			if(!!options.criteria) {
				throw new Error("Cannot supply criteria when calling 'all'");
			}
			return _query(self.connection, classToQuery, options);
		}
	}

	module.exports = new Minimap();
})();