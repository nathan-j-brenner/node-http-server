#!/usr/bin/env node

/*jshint node:true */
'use strict';

var fs = require('fs');
var querystring = require('querystring');
var path = require('path');
var url = require('url');
var http = require('http');
var server = http.createServer();

/*
HTTP responses can include a media type indicating what sort of stuff
the server's sending back. This looks at a filename's extension and
attempts to determine the media type.
*/
function determineMediaType(filename) {
  var extension = path.extname(filename).replace('.', '', 1);
  var knownTypes = {
    txt: "text/plain",
    html: "text/html",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    js: "text/javascript",
    css: "text/css"
  };

  return knownTypes[extension];
}

/*
The "database." A list of users; their "id" is their index into this array. Deleting a user
means setting their entry to null, so as not to re-index the list (since the page JS can know about indices).
*/
var contacts = [];

/*
Given a filename, serve it from the public/ folder. Attempt to infer its media-
type based on its extension. Sends headers and body and calls end, so don't do
anything with the response before or after sending it to this function.
*/
function serveFile(filename, response) {
  var headers = {};
  var mediaType = determineMediaType(filename);
  if (mediaType !== undefined) {
    headers['Content-Type'] = mediaType;
  }
  response.writeHead(200, headers);

  // Here we read the file contents and send them to the response.
  var readStream = fs.createReadStream(__dirname + '/public/' + filename);
  readStream.on('data', function(data) {
    response.write(data);
  });
  readStream.on('end', function() {
    response.end();
  });
}

/*
This is the main entry point for all API calls. It will look at the request
and delegate to one of the individual handlers.
*/
function handleAPICall(apiPath, request, response) {
  if (request.method.toUpperCase() === 'POST' && apiPath.match(/^people$/)) {
    addUser(apiPath, request, response);
  } else if (request.method.toUpperCase() === 'PATCH' && apiPath.match(/^people\/\d+$/)) {
    updateUser(apiPath, request, response);
  } else if (request.method.toUpperCase() === 'GET' && apiPath.match(/^people$/)) {
    listUsers(apiPath, request, response);
  } else if (request.method.toUpperCase() === 'DELETE' && apiPath.match(/^people\/\d+$/)) {
    deleteUser(apiPath, request, response);
  } else {
    sendError(response, "Didn't understand your request!");
  }
}

/*
Add a new user to the database. Read the request body, then parse it with the built-in
querystring module. Do some basic validation (age must be a number-like thing), then
respond with JSON indicating success.
*/
function addUser(apiPath, request, response) {
  var body = '';
  request.on('data', function(chunk) {
    body += chunk;
  });

  request.on('end', function() {
    body = querystring.parse(body);
    var index = contacts.length,
        responseBody;

    if (isNaN(body.age)) {
      sendError(response, "Age must be a number (it's *just* a number, after all)");
    } else {
      contacts[index] = body;
      responseBody = JSON.stringify({status: 'ok', index: index});
      response.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': responseBody.length});
      response.write(responseBody);
      response.end();
    }
  });
}

/*
Update a user. Reads the request body just like addUser does, and does the same validation on age.
Also checks to see that it's getting a valid user-index.
*/
function updateUser(apiPath, request, response) {
  var body = '';
  request.on('data', function(chunk) {
    body += chunk;
  });

  request.on('end', function() {
    var index = Number(apiPath.replace('people/', '')),
        responseBody;
    body = querystring.parse(body);

    if (contacts[index] === undefined || contacts[index] === null) {
      sendError(response, "No such user :" + index);
    } else if (isNaN(body.age)) {
      sendError(response, "Age must be a number (it's *just* a number, after all)");
    } else {
      contacts[index] = body;
      responseBody = JSON.stringify({status: 'ok', index: index});
      response.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': responseBody.length});
      response.write(responseBody);
      response.end();
    }
  });
}

/*
Return a list of all the contacts. JSON.stringify is sufficient here, since the "database" is just an in-memory
array. Notice that the page JS is responsible for filtering out null entries, so that it gets the right indices.
Suppose our contacts looked like
  [
    {"name": "Alice"},
    null,
    {"name": "Charles"}
  ]

If we filtered out nulls here, when the page received the list of users, it would think Charles's index was 2,
instead of 3, so updates to Charles would fail.
*/
function listUsers(apiPath, request, response) {
  var responseBody = JSON.stringify(contacts);
  response.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': responseBody.length});
  response.write(responseBody);
  response.end();
}

/*
Delete the given user by ID. Deleting in this case means replacing with null, so as to avoid reindexing.
The request body doesn't have anything to tell us; we're just interested in the user-index on the url.
*/
function deleteUser(apiPath, request, response) {
  var responseBody,
      index = Number(apiPath.replace('people/', ''));

  if (contacts[index] === undefined || contacts[index] === null) {
    sendError(response, "No such user :" + index);
  } else {
    contacts[index] = null;
      responseBody = JSON.stringify({status: 'ok'});
      response.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': responseBody.length});
      response.write(responseBody);
      response.end();
  }
}

/*
Helper method for sending back API errors. It sends a generic HTTP 400 BAD REQUEST, with some json
whose "error" attribute indicates the problem.
*/
function sendError(response, message) {
  var responseBody = JSON.stringify({status: 'error', error: message});
  response.writeHead(400, {'Content-Type': 'application/json', 'Content-Length': responseBody.length});
  response.write(responseBody);
  response.end();
}

/*
The main request listener. Requests for / get the index.html that lives in public/.
Requests for /api/a/n/y/t/h/i/n/g/ get sent on to handleAPICall.
For any other request, try to serve it as a file in public/.
*/
server.on('request', function(request, response) {
  var pathname = url.parse(request.url).pathname;
  if (pathname === '/') {
    serveFile('index.html', response);
  } else if (pathname.slice(0, 5) === '/api/') {
    handleAPICall(pathname.slice(5), request, response);
  } else {
    // fs.exists takes a filename and calls a callback with a boolean
    // indicating whether that file exists.
    fs.exists(__dirname + '/public/' + pathname, function(exists) {
      if (exists) {
        serveFile(pathname, response);
      } else {
        // that file didn't exist, so send back a 404 Not Found
        var body = '404 NOT FOUND';
        response.writeHead(404, {
          'Content-Length': body.length,
          'Content-Type': 'text/plain'
        });
        response.write(body);
        response.end();
      }
    });
  }
});

console.log("Now listening on port 9001");
server.listen(9001);
