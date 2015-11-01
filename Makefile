devel: 
	NODE_ENV=development node ./bin/www
start: 
	NODE_ENV=production node ./bin/www
nasdaq:
	EXCHANGE=NASDAQ node ./bin/www
nyse:
	EXCHANGE=NYSE node ./bin/www
parse-nasdaq:
	EXCHANGE=NASDAQ NODE_ENV=parse node ./bin/www
parse-nyse:
	EXCHANGE=NYSE NODE_ENV=parse node ./bin/www
cleandb:
	NODE_ENV=cleanup node ./bin/www
