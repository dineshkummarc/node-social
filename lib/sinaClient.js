/**
 * Sina Weibo OAuth Client
 * Insprited by https://github.com/bang590/node-weibo-oauth
 * @author Tang Bo Hao
 */

// Local Require
var util = require('util'),
	OAuth = require('oauth').OAuth,
	ClientBase = require('./clientBase'),
	querystring = require('querystring');
		
var sinaClient = module.exports = function sinaClient(appinfo, user) {
	ClientBase.call(this);
	this.name = 'sina';
	
	if(user && user.token){
		this.token = user.token;
		this.secret = user.secret;
	}
	// Create OAuth Object based on config
	this.oa = new OAuth(
		this.api.apiurl + this.api.oauth_request_token,
		this.api.apiurl + this.api.oauth_access_token, /* oauth urls */
		appinfo.key, appinfo.secret, 1.0, /* cunsumer info*/
		null,"HMAC-SHA1");
};
util.inherits(sinaClient, ClientBase);

// Set API
sinaClient.prototype.api = require('./apiconfig').WeiboAPI;

/**
 * Authorization
 * @param {Request} req express request object
 * @param {Response} res express response object
 * @param {String} next_url set a next to url(can skip)
 * @param {Function} callback Callback Function
 * @param {Object} context 'this' object of callback
 */
sinaClient.prototype.authorize = function authorize(req, res, next_url, callback, context) {
	// check if ignore next_url
	if(next_url && typeof next_url !=="string"){
		context = callback;
		callback = next_url;
	}
	
	// define access return function
	function access_cbfunc(error, access_token, access_token_secret) {
		//Finally call back
		if (error) return callback.call(context, error);
		
		// store the access token in the session
		req.session.authorized_user = { 
			platform: this.name,
			token: access_token,
			secret: access_token_secret };
		callback.call(context, null, req.session.authorized_user);
	}
	
	// if has token, directly return
	if(this.token && this.secret){
		return access_cbfunc(null, this.token, this.secret);
	}
	
	// This is get access token round
	if(req.param("oauth_token") && req.param("oauth_verifier")){
		this.oa.getOAuthAccessToken(
			req.session.oauth_token, 
			req.session.oauth_token_secret, 
			req.param('oauth_verifier'),
			function(error, oauth_access_token, oauth_access_token_secret, otherresults) {
				delete req.session.oauth_token;
				delete req.session.oauth_token_secret;
				
				access_cbfunc(null, oauth_access_token, oauth_access_token_secret);
			});
	}
	else // This is get request token round
	{
		var callback_url = "http://"+req.header('Host') + req.url,
				authorizeUrl = this.api.apiurl + this.api.oauth_authorize;
		// check next url to set callback url
		callback_url += (next_url && next_url != "") ? "?next="+querystring.escape(next_url) : "";

		this.oa._authorize_callback = callback_url;
		
		this.oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret,  results){
			if (error) return callback.call(context, error);
			
			req.session.oauth_token = oauth_token;
			req.session.oauth_token_secret = oauth_token_secret;
			
			res.redirect(authorizeUrl+"?oauth_token="+oauth_token + '&oauth_callback=' + callback_url);
		});
	}
};
	
/* ==!====== Restful Method =========
   Get, Post, Delete
   ================================== */
/**
 * Restful Get Method
 * @param api API Target
 * @param param parameters
 * @param callback Template: function( err, data, response )
 * @param {Object} context 'this' object of callback
 */
sinaClient.prototype.get = function get(api, param, callback, context) {
	if (!this.token || !this.secret) return callback.call(context, "not authorized");
	url = this.api.apiurl + url + this.api.result_format;
	url += param ? ('?' + querystring.stringify(param)) : '';

	this.oa.get(url, this.token, this.secret, 
	 function(error, data, res) {
	 	data = JSON.parse(data);
		callback.call(context, error, data, res);
	});
};

/**
 * Restful Post/Put Method
 * @param api API Target
 * @param body HTTP request content
 * @param callback Template: function( err, data, response )
 * @param {Object} context 'this' object of callback
 */
sinaClient.prototype.post = function post(api, body, callback, context) {
	if (!this.token || !this.secret) return callback.call(context, "not authorized");
	
	this.oa.post(this.api.apiurl + url + this.api.result_format, this.token, this.secret, body, null,
	 function(error, data, res) {
	 	data = JSON.parse(data);
		callback.call(context, error, data, res);
	});
};

/**
 * Restful Delete Method
 * @param api API Target
 * @param callback Template: function( err, data, response )
 */
sinaClient.prototype.del = function del(api, callback) {
	if (!this.token || !this.secret) return callback.call(context, "not authorized");
	
	this.oa["delete"](this.api.apiurl + url + this.api.result_format, this.token, this.secret, callback );
};
