var async = require('async');
var request = require('request');
var _ = require('lodash-node');
var OAuth = require('oauth-1.0a');
var config = require('../config/config.js');
var mongoose = require('mongoose');
var Exchange = mongoose.model('Exchange');

var numberOfQuotes = 0;
var stockPrices = {};
var unavailableSymbols = '';
var symbolString = '';
var NODE_ENV = process.env.NODE_ENV;
var EXCHANGE = process.env.EXCHANGE || config.parser.exchanges[1];
var DAYINMIL = 86400000;
var ENDDAYS = 5;

var oauth = OAuth({
    consumer: config.consumer,
    signature_method: 'HMAC-SHA1'
});

var DATE = new Date();
var today = DATE.getDay();

var ISWEEKEND = (today === 6 || today === 0);
var urlName = ISWEEKEND ? 'weekendUrl' : 'url';

var min = 15;
var max = 35;
var allQuotes = [];
var rateLimitStock;

var finder = {
	option: undefined,
	cashReturn: undefined,
	getStock: function(){
		Exchange.find({'name': EXCHANGE}, function(err, docs){
			var exch = docs[0];
			var symbols;
    		if (err) {
    			console.error('ERROR:', err);
    		}

    		if (NODE_ENV === 'production') {
    			symbols = exch.symbols;
    		} else {
    			symbols = exch.symbols.substring(0, 200).replace(/,\w+$/,'').replace(/,$/,'');
    		}
    		getMarketPrice(symbols);
    	});
	},
	cleanDB: function(){
		var i = 0;
		var limit = [];
		var noOptions = [];
		var symbols;
		var lastSymbol = '';

		var removeFromDB = function(){
			Exchange.find({'name': EXCHANGE}, function(err, docs){
				var doc = docs[0];
				if (err) {
	    			console.error('ERROR:', err);
	    			return;
	    		}
	    		console.log('REMOVING ', noOptions.length + ' from ', doc.symbols.length);
	    		noOptions.forEach(function(s){
	    			doc.symbols = doc.symbols.replace(s, '');
	    		});

	    		doc.symbols = doc.symbols.replace(/\,+/g, ',');
	    		
	    		doc.save(doc);
	    		noOptions = [];
	    		console.log('REMOVED ', noOptions.length + ' from ', doc.symbols.length);
	    	});
		};	

		var doesOptionExist = function(){
			var symbol = symbols[i];
			var url = config.url.strikes + '?symbol='+symbol;
			var request_data = {
			    url: url,
			    method: 'GET'
			};

			if (limit.length) {
				if (i < symbols.length - 1){
					limit.push(symbol);
					i++;
					doesOptionExist();
					
				} else {
					console.log('Timeout 1 minute', limit.length + ' stocks left');
					i = 0;
					symbols = limit;
					limit = [];


					setTimeout(function(){
						doesOptionExist();
					}, 60000);

					removeFromDB();
				}

				return;
			} else {
				if (i === symbols.length - 1) {
					removeFromDB();
				}
			} 

			request({
			    url: request_data.url,
			    method: request_data.method,
			    headers: oauth.toHeader(oauth.authorize(request_data, config.token))
			}, function(error, response, body) {
				var data;
				process.stdout.write('*');
				if (!error && response.statusCode === 200) {
					data = JSON.parse(body);

					if (data.response.name === 'RateLimitingFailure' ) {
						process.stdout.write('.');
						limit.push(symbol);
					}
				} else {
					if (response && response.statusCode === 500) {
						process.stdout.write('-' + symbol);
						noOptions.push(symbol);
					} else {
						process.stdout.write('^');
					}
				}

				i++;
				doesOptionExist();
			});
		};

		Exchange.find({'name': EXCHANGE}, function(err, docs){
			if (err) {
    			console.error('ERROR:', err);
    			return;
    		}

			symbols = docs[0].symbols.split(',');
			if (lastSymbol) {
				var idx = symbols.indexOf(lastSymbol);
				
				if (idx !== -1) {
					symbols.splice(0, idx - 1);
				}
				
			}
 			console.log('LEN: ', symbols.length);
			doesOptionExist();
    	});
	}
};


//Get the current market price for the list of stock symbols and
//pass them to getBestOptions() to get option bigs and calculations
var getMarketPrice = function(stockSymbols){
	var url = config[urlName].stock;

	var request_data = {
	    url: url,
	    method: ISWEEKEND ? 'GET' : 'POST'
	};

	var start = +new Date();
	
	request({
	    url: request_data.url,
	    method: request_data.method,
	    formData: {
	    	symbols: stockSymbols,
	    	fids: 'bid,last,beta'
	    },
	    headers: oauth.toHeader(oauth.authorize(request_data, config.token))
	}, function(error, response, body) {
		var end = +new Date();
		var diff = (end - start) / 1000;
		var data;
		var quotes = [];
		
		if (!error && response.statusCode === 200) {
			data = JSON.parse(body);
			console.log('Seconds:', diff);
			
			if (data.response && data.response.quotes && data.response.quotes.quote) {
				//get stick within range min-max
				quotes = findStockRange(data.response.quotes.quote);
				console.log('Looking up ', quotes.length, 'stocks');
				if (quotes.length) {
					getBestOptions(quotes);
				} else {
					console.log('No stock within range');
					return;
				}
			} else {
				console.log('ERROR: ', data.response);
			}
			
		} else {
			console.log('ERROR: ', error, response.statusCode);
		}
	});
};

//Return stocks within min and max range
var findStockRange = function(quotes){
	return _.filter(quotes, function(quote) {
	  return quote.last >= min && quote.last <= max;
	});
};

//Get the stock symbol with the bigget option bid
var getBiggestOptionBid = function(quotes){
	var biggest = '0';
	var bigO;

	quotes.forEach(function(quote){
		if(!quote || !quote.bid || parseFloat(quote.bid) === 0 || 
			!stockPrices[quote.rootsymbol]) {
				return;
		}

		var lastStockPrice = stockPrices[quote.rootsymbol].last;
		var beta = stockPrices[quote.rootsymbol].beta;

		var optionBidCash = parseFloat(quote.bid) * 100;
		var stockBidCash = parseFloat(quote.strikeprice) * 100 - 
			parseFloat(lastStockPrice) * 100;
		
		var cashReturn = stockBidCash + optionBidCash;

		if (parseFloat(quote.bid) > parseFloat(biggest)) {
			biggest = quote.bid;
			bigO = quote;
			bigO.cash = cashReturn;
			bigO.stockCash = stockBidCash;
			bigO.optionCash = optionBidCash;
			bigO.lastStockPrice = lastStockPrice;
			bigO.beta = beta;
		}
	});

	return bigO;
};

//Get the stock symbol with the bigget possible cash return for an execution period
var getBiggestReturn = function(quotes){
	var biggest = '0';
	var bigO;

	quotes.forEach(function(quote){
		if(!quote || !quote.bid || parseFloat(quote.bid) === 0|| 
			!stockPrices[quote.rootsymbol]) {
			return;
		}

		var lastStockPrice = stockPrices[quote.rootsymbol].last;
		var beta = stockPrices[quote.rootsymbol].beta;
		var optionBidCash = parseFloat(quote.bid) * 100;
		var stockBidCash = parseFloat(quote.strikeprice) * 100 - 
			parseFloat(lastStockPrice) * 100;
		
		var cashReturn = stockBidCash + optionBidCash;

		if (cashReturn > parseFloat(biggest)) {
			biggest = cashReturn;
			bigO = quote;
			bigO.cash = cashReturn;
			bigO.stockCash = stockBidCash;
			bigO.optionCash = optionBidCash;
			bigO.lastStockPrice = lastStockPrice;
			bigO.beta = beta;
		}
	});
	return bigO;
};

//Get the list of option bids and pass them to getBiggestOptionBid() and 
//getBiggestReturn() for calculations
var getOptionBids = function(stock, callback) {
	//format date to match 20150529 format
	var startDate = getFormatedDate(DATE);
	var numberOfDays = DAYINMIL * ENDDAYS;
	var dateInAWeek = new Date(+DATE + numberOfDays);
	var endDate = getFormatedDate(dateInAWeek);
	

	var query = 'put_call-eq:call AND ' + 
		'xdate-gte:' + startDate + ' AND xdate-lte:' + endDate + ' AND ' +
		'strikeprice-gte:' + stock.last + ' AND strikeprice-lte:' + (parseFloat(stock.last) + 1);

	var url = config[urlName].search + '?symbol=' + stock.symbol + 
		'&fids=contract_size,bid,last,strikeprice,rootsymbol,xday,xmonth,xyear&query=' + query;
	
	var request_data = {
	    url: url,
	    method: 'GET'
	};

	request({
	    url: request_data.url,
	    method: request_data.method,
	    headers: oauth.toHeader(oauth.authorize(request_data, config.token))
	}, function(error, response, body) {
		var data;

		if (!error && response.statusCode === 200) {
			data = JSON.parse(body);
			
			if (data.response.quotes && data.response.quotes.quote) {
				numberOfQuotes++;
				process.stdout.write('.');
				
				if (!data.response.quotes.quote.length) {
					data.response.quotes.quote = [data.response.quotes.quote];
				}

				stockPrices[stock.symbol] = stock;
				allQuotes = allQuotes.concat(data.response.quotes.quote);
			} else {
				
				if (data.response.name === 'RateLimitingFailure' ) {
					rateLimitStock.push(stock);
				}
			}
		} else {
			unavailableSymbols += stock.symbol + ',';
		}

		callback();
	});
};

//Go through the list of stock symbols the calculate the best option to buy
var getBestOptions = function(stockPrices) {
	
	rateLimitStock = [];

	async.each(stockPrices, getOptionBids, function(err){
		if (rateLimitStock.length) {
			console.log('Timeout 1 minute', rateLimitStock.length + ' stocks left');
			setTimeout(function(){
				getBestOptions(rateLimitStock);
			}, 60000);
		} else {
			console.log('\n Got calls for ', numberOfQuotes, 'stock symbols \n');

			printResult(getBiggestOptionBid(allQuotes), 'option');
			printResult(getBiggestReturn(allQuotes), 'cashReturn');

			console.log('\n', 'Unavailable options:', unavailableSymbols);
		}
	});
};

var printResult = function(option, type) {
	if (option) {
		option.xdate = option.xmonth + '-' + option.xday + '-' + option.xyear;
		
		console.log('-', option.rootsymbol+'('+option.lastStockPrice+') Call @', 
			option.bid, 'with strike', option.strikeprice, 'ends on', option.xdate, '|' + 
			'('+ String.fromCharCode(946) +':'+ option.beta + ')' + option.stockCash, '+', option.optionCash, '=', option.cash + '$');
			
		finder[type] = option;
	} else {
		console.log('No data for ' + type);
	}
};

var getFormatedDate = function(dateObj){
	return dateObj.getFullYear() + '' + 
		("0" +(dateObj.getMonth()+1)).slice(-2) + 
		("0" + dateObj.getDate()).slice(-2);
};

module.exports = finder;
