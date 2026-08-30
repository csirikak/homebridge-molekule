"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpAJAX = void 0;
const amazon_cognito_identity_js_1 = require("amazon-cognito-identity-js");
// Molekule API settings
const ClientId = "1ec4fa3oriciupg94ugoi84kkk";
const PoolId = "us-west-2_KqrEZKC6r";
const url = "https://api.molekule.com/users/me/devices/";
class HttpAJAX {
    constructor(log, config) {
        this.token = "";
        this.authError = false;
        this.log = log;
        this.email = config.email;
        this.pass = config.password;
        this.authenticationData = {
            Username: this.email,
            Password: this.pass,
        };
        this.userPoolData = {
            UserPoolId: PoolId,
            ClientId,
        };
        this.userPool = new amazon_cognito_identity_js_1.CognitoUserPool(this.userPoolData);
        this.userData = {
            Username: this.email,
            Pool: this.userPool,
        };
        this.authenticationDetails = new amazon_cognito_identity_js_1.AuthenticationDetails(this.authenticationData);
        this.cognitoUser = new amazon_cognito_identity_js_1.CognitoUser(this.userData);
    }
    refreshIdToken() {
        return new Promise((resolve, reject) => this.cognitoUser.refreshSession(this.refreshToken, (err, session) => {
            if (err) {
                this.log.info("ID token fetch using refresh token failed. Fallback to username/password");
                this.log.debug(err);
                reject(err);
            }
            else {
                this.log.info("✓ Token refresh successful");
                this.authError = false;
                this.token = session.getIdToken().getJwtToken();
                resolve(session);
            }
        }));
    }
    initiateAuth() {
        this.log.debug("email: " + this.email);
        return new Promise((resolve, reject) => this.cognitoUser.authenticateUser(this.authenticationDetails, {
            onSuccess: (result) => {
                this.refreshToken = result.getRefreshToken();
                this.log.info("✓ Valid Login Credentials");
                this.authError = false;
                this.token = result.getIdToken().getJwtToken();
                resolve(this.token);
            },
            onFailure: (err) => {
                this.log.error("API Authentication Failure, possibly a password/username error.");
                reject(err);
            },
        }));
    }
    async httpCall(method, extraUrl, send, retry) {
        if (this.authError)
            await this.refreshIdToken().catch((e) => {
                this.initiateAuth().catch((err) => {
                    this.log.error(err);
                });
                this.log.debug(e);
            });
        if (this.token === "" || this.authError)
            await this.initiateAuth().catch((err) => {
                this.log.error(err);
            });
        const contents = {
            method,
            headers: {
                authorization: this.token,
                "x-api-version": "1.0",
                "content-type": "application/json",
            },
        };
        if (method !== "GET")
            contents.body = send;
        let response;
        try {
            response = await fetch(url + extraUrl, contents);
        }
        catch (e) {
            this.log.error(e);
            return new Response(null, { status: 404 });
        }
        this.log.debug("HTTP " +
            method +
            " STATUS: " +
            response.status +
            (method !== "GET" ? " With contents: " + send : ""));
        if (response.status === 401 && retry > 0) {
            this.authError = true;
            return await this.httpCall(method, extraUrl, send, retry - 1);
        }
        return response;
    }
}
exports.HttpAJAX = HttpAJAX;
//# sourceMappingURL=cognito.js.map