# Chat Demo with PubNub and Objects

[PubNub](https://www.pubnub.com/?devrel_gh=pubnub-objects-js-chat-demo) provides APIs for Connected Experiences. You can build solutions combining in-app chat, live notifications, device control, and more.

This chat demo uses plain old JavaScript to offer a global chat and group chats to users. These are easily implemented by using Spaces, Users, and Memberships which are a part of [Objects](https://www.pubnub.com/docs/web-javascript/pubnub-objects?devrel_gh=pubnub-objects-js-chat-demo).

## Tutorial for Building Chat with PubNub and Objects
**[Blog post for Building Chat with PubNub and Objects](https://www.pubnub.com/blog/?devrel_gh=pubnub-objects-js-chat-demo)**

[![PubNub Chat with Objects in JavaScript Screenshot](https://i.imgur.com/PPyvGDA.png)](https://adambavosa.com/pubnub-js-webrtc/example/)

## Run
Make a PubNub Account and get your forever free [PubNub API Keys](https://dashboard.pubnub.com/signup?devrel_gh=pubnub-objects-js-chat-demo). Then enable **Storage & Playback** with unlimited retention in the [Admin Dashboard](https://dashboard.pubnub.com/?devrel_gh=pubnub-objects-js-chat-demo). This will store your chat app's messages, so users can see messages they missed when they log on later.

Insert your PubNub API keys into **app.js**
```js
const PUBNUB_PUBLISH_KEY = '_your_pubnub_publish_key_here_';
const PUBNUB_SUBSCRIBE_KEY = '_your_pubnub_subscribe_key_here_';
```

Open the `index.html` file in your browser, or push the repository to your GitHub and enable GitHub pages.
