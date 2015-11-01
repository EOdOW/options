var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var OAuth = require('oauth-1.0a');
var config = require('../config/config.js');
var mongoose = require('mongoose');
var Exchange = mongoose.model('Exchange');

var idx = 0;
var stockPrices = [];
var symbolString = '';

var NODE_ENV = process.env.NODE_ENV;
var EXCHANGE = process.env.EXCHANGE || config.parser.exchanges[0];

var exchage = {name: EXCHANGE, symbols: ''};

var parser = {
	get: function(){
		process.stdout.write('Getting Symbols for ' + EXCHANGE + '.');
		getPrices();
	}
};

var getPrices = function(){
	var letters = config.letters[NODE_ENV] || config.letters.development;
	var url = config.parser.url + EXCHANGE + '/' + letters[idx] + '.htm';

	request(url, function(error, response, html){
	    if (error){
	        return console.log(error);
	    }
	    process.stdout.write(letters[idx] + '.');
	    var $ = cheerio.load(html);
	    var rows = $('table.quotes').first().find('tr');

	    rows.each(function(i, elem){
	    	var price = $(elem).find('td:nth-child(5)').text();
	    	var name = $(elem).first().find('a').text();
	    	var floatPrice = parseFloat(price);
	    	
	    	if (name.match('-') || !name || name.match('\\.')) {
	    		return;
	    	}
	    	
	    	exchage.symbols += name.toLowerCase() + ',';
	    });

	    idx++;

	    if (idx < letters.length) {
	    	getPrices();
	    } else {
	    	//remove last comma
	    	exchage.symbols = exchage.symbols.replace(/,$/, '');

	    	Exchange.create(exchage, function(err, d){
	    		if (err) {
	    			console.error('ERROR:', err);
	    		}
	    	});
	    }
	});
};

module.exports = parser;