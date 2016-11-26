var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var StationSchema = new Schema({
	stationCode: {type: String, index:true},
	stationName: String
});

module.exports = function(db){
	return db.model('Station',StationSchema);
} 

