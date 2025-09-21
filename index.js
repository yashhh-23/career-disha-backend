// Cloud Functions entrypoint to run Express app serverlessly
require('dotenv').config();
const functions = require('@google-cloud/functions-framework');
const app = require('./src/server');

functions.http('api', app);


