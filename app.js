// set up the express app
const express = require('express');
const app = express();
const port = 3000;

// set up the database driver
let mysql = require('mysql');

// import config module
let config = require('./config')

// middleware for parsing application/json in the req.body
app.use(express.json())

app.listen(port, () => {
	console.log('app started');
});

// serve static assets (the react app)
app.use(express.static('public'))

app.get('/getComments', (req,res) => {

	//connect to the database and grab the comments
	let connection = mysql.createConnection({
		host: config.db.host,
		user: config.db.user,
		password: config.db.password,
		database: config.db.database
	});
	connection.connect();
	// use a subquery to select only the last 30 rows
	connection.query('SELECT * FROM (SELECT * FROM `comments` ORDER BY id DESC LIMIT 30) sub ORDER BY id ASC', 
		function(err, results, fields) {
			if (err) throw err
			res.send(results);
		}
		);
		
	connection.end();
	
});

app.post('/submitComment', (req, res) => {
	

	//connect to the database and submit the comment
	let connection = mysql.createConnection({
		host: config.db.host,
		user: config.db.user,
		password: config.db.password,
		database: config.db.database
	});

	let payload = req.body;
	
	
	connection.connect();
	
	connection.query(`INSERT INTO comments (username, color, comment) VALUES ("${payload.username}", "${payload.color}", "${payload.comment}")`, 
		function(err, results, fields) {
			if (err) throw err
		}
	);

	// Delete the first row so that the datase waste no data saving old comments
	connection.query('DELETE FROM comments ORDER BY id LIMIT 1', 
		function(err, results, fields) {
			if (err) throw err
		}
	);
		
	connection.end();
	
	res.send('success');
})