import { Logger, PlatformConfig } from 'homebridge'
import {
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUser,
  CognitoRefreshToken
} from 'amazon-cognito-identity-js'
import('node-fetch');
let token = ''
let refreshToken: CognitoRefreshToken
let authError: boolean
// Molekule API settings
const ClientId = '1ec4fa3oriciupg94ugoi84kkk'
const PoolId = 'us-west-2_KqrEZKC6r'
const url = 'https://api.molekule.com/users/me/devices/'
export class HttpAJAX {
  private readonly log: Logger
  email: string
  pass: string
  authenticationData
  userData
  userPool
  authenticationDetails
  cognitoUser
  userPoolData
  constructor (log: Logger, config: PlatformConfig) {
    this.log = log
    this.email = config.email
    this.pass = config.password
    this.authenticationData = {
      Username: this.email,
      Password: this.pass
    }
    this.userPoolData = {
      UserPoolId: PoolId,
      ClientId
    }
    this.userPool = new CognitoUserPool(this.userPoolData)
    this.userData = {
      Username: this.email,
      Pool: this.userPool
    }
    this.authenticationDetails = new AuthenticationDetails(this.authenticationData)
    this.cognitoUser = new CognitoUser(this.userData)
  }
  refreshAuthToken() {
    return new Promise((resolve, reject) =>
    this.cognitoUser.refreshSession(refreshToken, (err, session) => {
      if (err){
        this.log.info('Auth token fetch using refresh token failed. Fallback to username/password')
        this.log.debug(err)
        reject(err)
      }
      else {
        this.log.info('✓ Token refresh successful')
        authError = false
        token = session.getAccessToken().getJwtToken()
        resolve(session)
      }
    }));
  }
  initiateAuth () {
    this.log.debug('email: ' + this.email)
    this.log.debug('password: ' + this.pass)
    return new Promise((resolve, reject) =>
      this.cognitoUser.authenticateUser(this.authenticationDetails, {
        onSuccess: (result) => {
          token = result.getAccessToken().getJwtToken()
          refreshToken = result.getRefreshToken()
          this.log.info('✓ Valid Login Credentials')
          authError = false
          resolve(result.getAccessToken().getJwtToken())
        },
        onFailure: (err) => {
          this.log.error('API Authentication Failure, possibly a password/username error.');
          reject(err)
        }
      }))
  }
  async httpCall (method: string, extraUrl: string, send: string, retry: number): Promise<Response> {
    let response:Response;
    if (authError) await this.refreshAuthToken().catch(e => {this.initiateAuth().catch(e => {this.log.error(e);return});this.log.debug(e)})
    if ((token === '') || authError) await this.initiateAuth().catch(err => {this.log.error(err);return});
    if (method === 'GET') {
      const contents = {
        method,
        headers: { authorization: token, 'x-api-version': '1.0', 'content-type': 'application/json' }
      }
      response = await fetch(url + extraUrl, contents)
      this.log.debug('HTTP GET STATUS: ' + response.status)
      //this.log.debug('HTTP GET CONTENTS: ' + JSON.stringify(response))
      if (response.status === 401 && retry > 0) {
        authError = true
        return await this.httpCall(method, extraUrl, send, retry - 1)
      } 
      else return response;
    } 
    else {
      const contents = {
        method,
        body: send,
        headers: { authorization: token, 'x-api-version': '1.0', 'content-type': 'application/json' }
      }
      response = await fetch(url + extraUrl, contents)
      this.log.debug('HTTP POST STATUS: ' + response.status + ' With contents: ' + send)
      if (response.status === 401 && retry > 0) {
        authError = true;
        return await this.httpCall(method, extraUrl, send, retry - 1);
      }
    }
    return response
  }
}
