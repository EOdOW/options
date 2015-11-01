var express = require('express');
var router = express.Router();
var finder = require('../modules/optionFinder.js');

/* GET home page. */
router.get('/', function(req, res, next) {	
  	res.render('index', { title: 'Express', option: finder.option });
});

module.exports = router;
