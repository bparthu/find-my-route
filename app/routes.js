var Todo = require('./models/todo');


// expose the routes to our app with module.exports
module.exports = function(app){
	// routes ======================================================================

    // api ---------------------------------------------------------------------
    // get all todos

    app.get('*',function(req,res){
    	res.sendfile('./public/index.html');
    });
};