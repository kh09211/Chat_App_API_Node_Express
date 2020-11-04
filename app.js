/*
 *
 * ****CHAT APP BACKEND****
 * The Chat App back end and API written by Kyle Hopkins in node.js with express 
 * 
 */

/*
 *
 * ****CONFIGURATION****
 * Here we will declare the variables and set config
 * 
 */

// set up the express app
const express = require('express');
const app = express();
const port = 3000;

// set up the database driver
let mysql = require('mysql');

// import config module
let config = require('./config')

// database connection configuration to be used for database queries
let dbObj = {
	host: config.db.host,
	user: config.db.user,
	password: config.db.password,
	database: config.db.database,
	multipleStatements: true
};

// declare other variables
const jwtKey = config.jwt.privateKey;
let timerOn = false;
let pruneUsersTimer;

// middleware for parsing application/json in the req.body
app.use(express.json())

// import json web tokens for api keys
const jwt = require('jsonwebtoken');
const e = require('express');

// serve static assets (the react app)
app.use(express.static('public'))


// start the node server
app.listen(port, () => {
	console.log('app started');
});



/*
 *
 * ****ROUTES***
 * Here we will will list all our routes
 *
 */

app.get('/getComments/:room', (req,res) => {
	//connect to the database and grab the comments along with the current users in the tokens table of the database. 

	let comments;
	let usernames;
	let room = req.params.room;
	let connection = mysql.createConnection(dbObj);

	connection.connect();
	// use a subquery to select only the last 50 rows
	connection.query(`SELECT * FROM (SELECT * FROM comments WHERE room='${room}' ORDER BY id DESC LIMIT 50) sub ORDER BY id ASC; SELECT username, color FROM tokens WHERE room='${room}';`, 
		function(err, results, fields) {
			if (err) throw err
			comments = results[0];
			usernames = results[1];

			// send the query results to the front end
			res.send({'comments': comments, 'usernames': usernames});
			
		}
		);
		
	connection.end();
});


app.post('/submitComment', (req, res) => {
	let payload = req.body;
	let token = payload.token;
	let color = payload.color;
	let comment = payload.comment;
	let room = payload.room;
	

	//verify the token before submitting comment
	jwt.verify(token, jwtKey, function(err, decoded) {
		if (err) {
			// the token is invalid
			res.send({token: 'invalid token'});
		} else {
			// the token is valid

			//connect to the database and submit the comment. then count the total room rows for possible cleanup

			let connection = mysql.createConnection(dbObj);
			connection.connect();
			connection.query(`INSERT INTO comments (username, color, comment, room) VALUES ("${decoded.username}", "${color}", "${comment}", "${room}"); SELECT COUNT(*) FROM comments WHERE room = '${room}'`, 
				function(err, results, fields) {
					if (err) throw err

					// if row count is more than 50, delete the last room row id
					if (results[1][0]['COUNT(*)'] > 50) {
						
						// nested query will end connection inside last callback
						// Delete the first row so that the datase waste no data saving excessive chat comments
						connection.query(`DELETE FROM comments WHERE room='${room}' ORDER BY id LIMIT 1`, 
							function(err, results, fields) {
								if (err) throw err

								connection.end();
							}
						);
					} else {
						// end conneciton without deleting any rows
						connection.end();
					}
				}
			);
			
			res.send('success');
		}
	});
});

app.post('/getToken', (req, res) => {
	// issue tokens either new user, as a token refresh or when user clicks "Go To Chat" button. this route also starts the timer if it's not already running

	let payload = req.body;
	let username = payload.username;
	let token = payload.token;
	let color = payload.color;
	let room = payload.room;
	let tokenExpireTime = 4 * 60; // token will be valid for 4 minutes, front end timer should refresh at 3
	

	// determine if this is a fresh user situation or a returning user with out without a change in username
	if (token == '') {
		// user is fresh

		token = jwt.sign({
					'username': username
					}, jwtKey, { expiresIn: tokenExpireTime });

		//insert fresh user username, color, and token into the tokens tabel of the database
		let connection = mysql.createConnection(dbObj);
		connection.connect();
		connection.query(`INSERT INTO tokens (username, token, color, room) VALUES ('${username}', '${token}','${color}', '${room}')`, 
			function(err, results, fields) {
				if (err) throw err
			}
		);
		connection.end();

		// return to the front end the new token
		res.send({'token': token});


		//if the timer is not currently running, start it by calling pruneUsers(). pruneUsers will determine which tokens are valid, remove the invalid ones
		if (! timerOn) {
			pruneUsers();
		}

	} else {
		// the user is either changing their username or the app is refreshing the user's token
		// verify token and match the decoded token payload username with the db row. Update both the token along with the new req.body payload username n color at the same time for efficiency, return to the user the new token
		jwt.verify(token, jwtKey, function(err, decoded) {
			if (err) {
				// the token is not valid
				res.send({token: 'invalid token'});
			} else {

				// the token is valid
				
				let newToken = jwt.sign({
										'username': username
										}, jwtKey, { expiresIn: tokenExpireTime });
				
				// UPDATE username and token into the tokens table of the database
				let connection = mysql.createConnection(dbObj);
				connection.connect();
				connection.query(`UPDATE tokens SET username='${username}', token='${newToken}', color='${color}' WHERE token = '${token}'`, 
					function(err, results, fields) {
						if (err) throw err
					}
				);
				connection.end();

				// return to the front end the new token
				res.send({'token': newToken});
			}
		});
	}
});

// Wildcard route that serves the static index html file but keeps the url intact for the react app
app.get('/*', (req,res) => {
	res.sendFile('index.html',{root: './public'});
})


/*
 *
 * ****FUNCTIONS****
 * Here contains any functions needed to make the app work propertly that are not tied to a single route
 *
 */


function pruneUsers() {
	// this function should be called from the getToken route
	// timer stops itself if the pruned list goes to 0

	// Connect to database and query the tokens table
	let connection = mysql.createConnection(dbObj);
	connection.connect();
	
	// Get all the tokens from the tokens table of the database
	connection.query(`SELECT * FROM tokens`, 
		function(err, results, fields) {
			let rowsToDelete = [];
			
			if (err) throw err;
			
			// Below will handle the timer based on the rows returned from results
			if (results.length >= 0 && !timerOn) {
				// if there is an active user or a user just entered the app and this quiery executed, start the timer to prune users
				startTimer();
			} else if (results.length == 0 && timerOn) {
				// if there are no users, stop the timer
				stopTimer();

			}

			// Determine the validity of each token
			results.forEach((row) => {
				jwt.verify(row.token, jwtKey, function(err, decoded) {
					// determine if token is valid or expired and add the id to rowsToDelete array, if valid do nothing
					if (err) {
						rowsToDelete.push(row.id);
					} 
				});
			});

			// nested query to delete any expired or non-valid tokens
			if (rowsToDelete.length > 0) {
				let rowsToDeleteString = rowsToDelete.join(', ');
		
				connection.query(`DELETE FROM tokens WHERE id IN (${rowsToDeleteString})`, 
					function(err, results, fields) {
						if (err) throw err;
		
						connection.end();
					}
				);
			} else {
				// nothing to delete
				connection.end();
			}
		}
	);
}

function checkForEmptyRooms() {
	// this function checks the database for any empty rooms and then purges their comments from the DB

	let connection = mysql.createConnection(dbObj);
	connection.connect();

	// get a list of unique room names from comments and tokens table
	connection.query(`SELECT DISTINCT room FROM comments; SELECT DISTINCT room FROM tokens;`, 
		function(err, results, fields) {
			if (err) throw err;

			// check to see if any rooms have zero users

			
			let commentsRooms = results[0];
			let tokensRooms = results[1];

			let emptyRooms = commentsRooms.filter(commentsRoom => {
				return ! tokensRooms.some((tokensRoom) => commentsRoom.room == tokensRoom.room);
			})

			//here we will purge any empty rooms before ending the connection
			if (emptyRooms.length > 0) {

				// clean up the array and format it for mysql
				let emptyRoomsArr = emptyRooms.map(raw => `'${raw.room}'`);
				let roomsStr = emptyRoomsArr.join(', ');

				// NESTED QUERY
				//Delete all comments whos room that match any of the empty rooms in the roomsStr
				connection.query(`DELETE FROM comments WHERE room IN (${roomsStr})`, 
					function(err, results, fields) {
						if (err) throw err;

						//end connection
						connection.end();
					}
				);
			} else {
				// there are no empty rooms to delete, end connection
				connection.end();
			}
		}
	);
}


function startTimer() {
	// Main app timer will start only if global timerOn is false and will exec fuction every 5 seconds
	if (!timerOn) {
		pruneUsersTimer = setInterval(() => {
			pruneUsers();
			checkForEmptyRooms();
		}, 5000)
		timerOn = true;
		console.log('Timer Started');
	}
}

function stopTimer() {
	// Stop the main app timer started in the starTimer() function above
	clearInterval(pruneUsersTimer);
	timerOn = false;
	console.log('TimerStopped')
	
}