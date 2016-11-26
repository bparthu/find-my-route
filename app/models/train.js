var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var TrainSchema = new Schema({
	id: {type: String, index:true},
	name: String,
	startStnCode: String,
	starts: String,
	endStnCode: String,
	ends: String
});

module.exports = function(db){
	return db.model('Train',TrainSchema);
} 

