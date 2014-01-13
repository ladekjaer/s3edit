#!/usr/bin/env node

var fs = require('fs');
var request = require('request');
var edit = require('string-editor');
var argv = require('optimist').argv;
var ini = require('ini');

var s3auth = {
    bucket: argv._[0]
};
if (!s3auth.bucket) {
    console.error('Bucket must be specified.');
    process.exit(1);
}

if (fs.existsSync(process.env.HOME+'/.aws/config')) {

    var configFile = fs.readFileSync(process.env.HOME+'/.aws/config', 'utf8');
    var config = ini.parse(configFile);

    if (argv.profile) {
        if (config['profile '+argv.profile]) {
            s3auth.key = config['profile '+argv.profile].aws_access_key_id;
            s3auth.secret = config['profile '+argv.profile].aws_secret_access_key;
        } else {
            console.error('Unknown profile');
            process.exit(1);
        }
    } else if (config.default) {
        s3auth.key = config.default.aws_access_key_id;
        s3auth.secret = config.default.aws_secret_access_key;
    }
} else {
    s3auth = {
        key: argv.key,
        secret: argv.secret,
    }
}

var path = argv._[1];
if (!path) {
    console.error('Missing path to file on S3.');
    process.exit(1);
}

var s3path = 'https://'+s3auth.bucket+'.s3.amazonaws.com/'+path;

var onResponse = function(fn) {
    return function(err, response, body) {
        if (err) throw err;
        if (response.statusCode !== 200) {
            body = '';
        }
        if (fn) fn(body);
    }
};

var filename = s3path.split('/').pop();

request.get(s3path, {
    aws: s3auth,
}, onResponse(function(body) {
    edit(body, filename, function(err, text) {
        var options = {
            aws: s3auth,
            body: text
        };
        if (argv.public) options.headers = {'x-amz-acl':'public-read'};
        request.put(s3path, options, onResponse());       
    });
}));


