// app/layout.tsx runs this in <head> to set <html data-account> before first
// paint when this browser holds Amplify tokens, so a returning member never
// sees the landing (or its intro) flash before their dashboard. A plain module:
// the server layout needs the string itself, not a client reference.
export const ACCOUNT_HINT_SCRIPT = `try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||"";if(k.indexOf("CognitoIdentityServiceProvider.")===0&&k.slice(-13)===".LastAuthUser"){document.documentElement.dataset.account="1";break}}}catch(e){}`;
