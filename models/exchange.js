var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var exchangeSchema = new Schema({
	name: String,
	symbols: String
});

module.exports = mongoose.model('Exchange', exchangeSchema);