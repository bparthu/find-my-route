// set up ========================
    var express  = require('express');
    var app      = express();                               // create our app w/ express
    var mongoose = require('mongoose');                     // mongoose for mongodb
    var morgan = require('morgan');             // log requests to the console (express4)
    var bodyParser = require('body-parser');    // pull information from HTML POST (express4)
    var methodOverride = require('method-override'); // simulate DELETE and PUT (express4)
    var database = require('./config/database');



    // configuration =================
    console.log(process.version);
    
    var conn = mongoose.createConnection(database.url);  

    /*conn.on('open', function () {
	    conn.db.listCollections().toArray(function (err, names) {
	        console.log(err, names);
	        conn.close();
	    });
	});*/


    // connect to mongoDB database on modulus.io

    app.use(express.static(__dirname + '/public'));                 // set the static files location /public/img will be /img for users
    // load the routes
    app.use(morgan('dev'));                                         // log every request to the console
    app.use(bodyParser.urlencoded({'extended':'true'}));            // parse application/x-www-form-urlencoded
    app.use(bodyParser.json());                                     // parse application/json
    app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
    app.use(methodOverride());

    app.set('view engine', 'ejs');

    require('./app/routes')(app,conn);
    // define model =================
    /*var Todo = mongoose.model('Todo', {
        text : String
    });*/

    var PORT = process.env.PORT || 8080;

    

    // listen (start app with node server.js) ======================================
    app.listen(PORT);
    console.log("App listening on port "+PORT);
