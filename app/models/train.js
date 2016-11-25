var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var TrainSchema = new Schema({
	id: {type: String, index:true},
	name: String,
	starts: String,
	ends: String
});

module.exports = mongoose.model('Train',TrainSchema);