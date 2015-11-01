module.exports = {
	'letters': {
		'production': ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'],
		'development': ['A','B','C']
	},
	'consumer': {
        public: '<consumer_public>',
        secret: '<consumer_secret>'
    },
    'token': {
	    public: 'token_public',
	    secret: 'token_secret'
	},
	url: {
		search: 'https://api.tradeking.com/v1/market/options/search.json',
		strikes: 'https://api.tradeking.com/v1/market/options/strikes.json',
		stock: 'https://api.tradeking.com/v1/market/ext/quotes.json'
	},
	weekendUrl: {
		search: 'http://553bf8bc7ae59b1100cb8a5b.mockapi.io/search/1',
		stock: 'http://553bf8bc7ae59b1100cb8a5b.mockapi.io/quotes/1'
	},
	parser: {
		url: 'http://eoddata.com/stocklist/',
		exchanges: ['NASDAQ','NYSE']
	}
};
