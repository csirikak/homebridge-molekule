"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpAJAX = void 0;
const amazon_cognito_identity_js_1 = require("amazon-cognito-identity-js");
import('node-fetch');
let token = '';
let authError;
// Molekule API settings
const ClientId = '1ec4fa3oriciupg94ugoi84kkk';
const PoolId = 'us-west-2_KqrEZKC6r';
const url = 'https://api.molekule.com/users/me/devices/';
class HttpAJAX {
    constructor(log, config) {
        this.log = log;
        this.config = config;
        this.email = config.email;
        this.pass = config.password;
    }
    initiateAuth() {
        const authenticationData = {
            Username: this.email,
            Password: this.pass
        };
        const userPoolData = {
            UserPoolId: PoolId,
            ClientId
        };
        const userPool = new amazon_cognito_identity_js_1.CognitoUserPool(userPoolData);
        const userData = {
            Username: this.email,
            Pool: userPool
        };
        const authenticationDetails = new amazon_cognito_identity_js_1.AuthenticationDetails(authenticationData);
        const cognitoUser = new amazon_cognito_identity_js_1.CognitoUser(userData);
        this.log.debug('email: ' + this.email);
        this.log.debug('password: ' + this.pass);
        return new Promise((resolve, reject) => cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: (result) => {
                token = result.getAccessToken().getJwtToken();
                this.log.info('✓ Valid Login Credentials');
                authError = false;
                resolve(result.getAccessToken().getJwtToken());
            },
            onFailure: (err) => {
                this.log.debug(err);
                this.log.error('API Authentication Failure, possibly a password/username error.');
                reject(err);
            }
        }));
    }
    ;
    async httpCall(method, extraUrl, send, retry) {
        if ((token === '') || authError)
            await this.initiateAuth();
        if (method === 'GET') {
            const contents = {
                method,
                headers: { authorization: token, 'x-api-version': '1.0', 'content-type': 'application/json' }
            };
            const response = await fetch(url + extraUrl, contents);
            this.log.debug('HTTP GET STATUS: ' + response.status);
            this.log.debug('HTTP GET CONTENTS: ' + response);
            if (response.status === 401 && retry > 0) {
                authError = true;
                return await this.httpCall(method, extraUrl, send, retry - 1);
            }
            else
                return response.json();
        }
        else if (method === 'POST') {
            const contents = {
                method,
                body: send,
                headers: { authorization: token, 'x-api-version': '1.0', 'content-type': 'application/json' }
            };
            const response = await fetch(url + extraUrl, contents);
            this.log.debug('HTTP POST STATUS: ' + response.status + ' With contents: ' + send);
            if (response.status === 401 && retry > 0) {
                authError = true;
                return await this.httpCall(method, extraUrl, send, retry - 1);
            }
            return response.status;
        }
    }
}
exports.HttpAJAX = HttpAJAX;
//# sourceMappingURL=cognito.js.map