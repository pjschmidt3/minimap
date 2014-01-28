var bogart = require('bogart')
	, minimap = require('../minimap');

var router = bogart.router()
	, app = bogart.app()
	, viewEngine = bogart.viewEngine('mustache');

app.use(bogart.batteries);

minimap.init({
	host : 'localhost',
	db : 'minimap',
	user : 'XXX',
	pass : 'XXX'
});

minimap.define('employee', {
	table : 'employees',
	mappings : {
		"id" : "Id",
		"name" : "FirstName",
		"jobTitle" : "JobTitle"
	}
	// , constructor : function () {

	// }
});

router.get('/', function ( req ) {
	return minimap.query('employee', {
		orderBy : 'name'
	})
	.then(function ( employee ) {
		console.log('employee: ', employee);
		return viewEngine.respond('index.html', { locals : { employees : employee }});
	});
});

app.use(router);
app.start({ port : 12345 });