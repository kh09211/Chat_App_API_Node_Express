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
global.rowsToDelete = []; // var used for global scope so that it can be used correctly within pruneUsers()
global.commentsToDelete = []; // used globally so that it can correctly clear chat rooms with no active users

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
	// use a subquery to select only the last 30 rows
	connection.query(`SELECT * FROM (SELECT * FROM comments WHERE room='${room}' ORDER BY id DESC LIMIT 50) sub ORDER BY id ASC; SELECT username, color FROM tokens WHERE room='${room}';`, 
		function(err, results, fields) {
			if (err) throw err
			comments = results[0];
			usernames = results[1];

			//if there are 0 users, destroy the chat and send empty arrays
			// note: this works but data stays in the databse until someone trys to enter the empty room. This self destructs when someone trys to enter which is not ideal. Moved to the timer
			/*
			if (usernames.length == 0) {
				purgeEmptyRoom(room);
				res.send({'comments': [], 'usernames': []});
			} else {
			*/

			// send the query results to the front end
			res.send({'comments': comments, 'usernames': usernames});
			//}
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

			//connect to the database and submit the comment.
			let connection = mysql.createConnection(dbObj);
			connection.connect();
			connection.query(`INSERT INTO comments (username, color, comment, room) VALUES ("${decoded.username}", "${color}", "${comment}", "${room}")`, 
				function(err, results, fields) {
					if (err) throw err
				}
			);


			// Delete the first row so that the datase waste no data saving old comments
			/*
			connection.query('DELETE FROM comments ORDER BY id LIMIT 1', 
				function(err, results, fields) {
					if (err) throw err
				}
			);
			*/
				
			connection.end();
			
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
				let decodedUsername = decoded.username;
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
			
			if (err) throw err;
			
			// Below will handle the timer based on the rows returned from results
			if (results.length > 0 && !timerOn) {
				// if there is an active user, start the timer to prune users
				startTimer();
			} else if (results.length == 0) {
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

		}
	);
	
	//Delete all non-valid token rows if any
	if (rowsToDelete.length > 0) {
		let rowsToDeleteString = rowsToDelete.join(', ');

		connection.query(`DELETE FROM tokens WHERE id IN (${rowsToDeleteString})`, 
			function(err, results, fields) {
				if (err) throw err;

				// reset the rowsToDelete global variable
				rowsToDelete = [];
			}
		);
	}

	connection.end();

}

function checkForEmptyRooms() {
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

			//here you will run the purgeEmptyRoom function passing the array of rooms
			if (emptyRooms.length > 0) {

				let emptyRoomsArr = emptyRooms.map(raw => `'${raw.room}'`);
				purgeEmptyRoom(emptyRoomsArr);
			}
		}
	);

	connection.end();
}

function purgeEmptyRoom(roomsArr) {
	// this function recieves the array with values wrapped in quotes, once joined this puts the rooms in the correct format to be deleted in one query

	let roomsStr = roomsArr.join(', ');
	let connection = mysql.createConnection(dbObj);
	connection.connect();


	//Delete all comments whos room that match any of the empty rooms in the roomsStr
	connection.query(`DELETE FROM comments WHERE room IN (${roomsStr})`, 
		function(err, results, fields) {
			if (err) throw err;
		}
	);
	
	connection.end();
}

function startTimer() {
	// Timer will start only if timerOn is false and exec fuction every 5 seconds
	if (!timerOn) {
		pruneUsersTimer = setInterval(() => {
			pruneUsers();
			checkForEmptyRooms();
		}, 5000)
		timerOn = true;
	}
}

function stopTimer() {
	// Stop the timer started in the starTimer() function
	clearInterval(pruneUsersTimer);
	timerOn = false;
}