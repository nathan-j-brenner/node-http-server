#!/usr/bin/env node

/*jshint node:true */
'use strict';

var fs = require('fs');
var querystring = require('querystring');
var path = require('path');
var url = require('url');
var http = require('http');
var server = http.createServer();
var pg = require('pg');
var knexConfig = require('./knexfile');
var knex = require('knex')(knexConfig);

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
The "database." You could replace this with a real database like postgres if
you want to. getId is generated with an IIFE to prevent accidentally accessing
lastId manually.
*/
var contacts = {};

var getId = (function() {
  var lastId = 0;
  return function getId() {
    lastId = lastId + 1;
    return lastId;
  };
})();

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
  // console.log(body);
  request.on('data', function(chunk) {
    body += chunk;
    // console.log(typeof body);
  });

  request.on('end', function() {
    body = querystring.parse(body);
    // console.log(body);
    // console.log(body.name);
    knex('contacts').insert({name: body.name, email: body.email, age: body.age}).then();
    var responseBody;

    if (isNaN(body.age)) {
      sendError(response, "Age must be a number (it's *just* a number, after all)");
    } else {
      body.id = getId();
      contacts[body.id] = body;
      responseBody = JSON.stringify({status: 'ok', id: body.id});
      response.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': responseBody.length});
      response.write(responseBody);
      response.end();
    }
  });
}

/*
Update a user. Reads the request body just like addUser does, and does the same validation on age.
Also checks to see that it's getting a valid user-id.
*/
function updateUser(apiPath, request, response) {
  var body = '';
  request.on('data', function(chunk) {
    body += chunk;
  });

  request.on('end', function() {
    var id = Number(apiPath.replace('people/', '')),
        responseBody;
    body = querystring.parse(body);

    if (contacts[id] === undefined || contacts[id] === null) {
      sendError(response, "No such user :" + id);
    } else if (isNaN(body.age)) {
      sendError(response, "Age must be a number (it's *just* a number, after all)");
    } else {
      body[id] = id;
      contacts[id] = body;
      responseBody = JSON.stringify({status: 'ok'});
      response.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': responseBody.length});
      response.write(responseBody);
      response.end();
    }
  });
}

/*
Return a list of all the contacts.
*/
function listUsers(apiPath, request, response) {
  var users = Object.keys(contacts).map(function (key) {
    return contacts[key];
  });
  knex('contacts').select('*').then(function(results){
    results = JSON.stringify(results);
    response.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': results.length});
    response.write(results);
    response.end();
  }).then();
}

/*
Delete the given user by ID.
The request body doesn't have anything to tell us; we're just interested
in the user-id on the url.
*/
function deleteUser(apiPath, request, response) {
  var responseBody,
      id = Number(apiPath.replace('people/', ''));

  if (contacts[id] === undefined) {
    sendError(response, "No such user :" + id);
  } else {
    delete contacts[id];
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
