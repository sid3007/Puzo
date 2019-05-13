var express = require('express');
var app = express();
var path = require('path');
var cors = require('cors');

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors());
app.use('/', express.static(__dirname + '/'));
app.listen(7000);