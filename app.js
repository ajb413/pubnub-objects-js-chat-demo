const usernameModal = document.getElementById('username-input-modal');
const usernameInput = document.getElementById('username-input');
const joinButton = document.getElementById('join-button');

const memberList = document.getElementById('member-list');
const chatList = document.getElementById('chatroom-list');
const chat = document.getElementById('chat');
const log = document.getElementById('log');
const messageInput = document.getElementById('message-input');
const submit = document.getElementById('submit');
const newChatRoomButton = document.getElementById('new-chat-room');
const hide = 'hide';

const CREATE_EVENT = 'create';
const UPDATE_EVENT = 'update';
const DELETE_EVENT = 'delete';
const SELECTED_CLASS = 'selected';

// PubNub Channel for sending/receiving global chat messages
//     also used for user presence with PubNub Presence
const globalChannel = 'global-channel';
let currentlySelectedChat = globalChannel; // Start off viewing the global chat

let pubnub;
let channelsToSubscribeTo;
let username; // User's name in the app

// Prompt the user for a username input
getLocalUserName().then((myUsername) => {
    username = myUsername;
    usernameModal.classList.add(hide);
    initChatApp();
});

// Send a chat message when Enter key is pressed
messageInput.addEventListener('keydown', (event) => {
    if (event.keyCode === 13 && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
        return;
    }
});

// Send a chat message when the submit button is clicked
submit.addEventListener('click', sendMessage);

// Lists the members for the selected chat in the UI
const addToMemberList = (member) => {
    console.log('addToMemberList', member);
    const userId = member.id;
    const name = member.name;

    if (!name) return;

    const userListDomElement = createUserListItem(userId, name);

    const alreadyInList = document.getElementById(userId);
    const isMe = pubnub.getUUID() === userId;

    if (alreadyInList) {
        removeFromMemberList(member.uuid);
    } 

    if (isMe) {
        return;
    }

    memberList.appendChild(userListDomElement);
};


const initChatApp = () => {
    const modifyChatRoomList = (spaceEvent, autoSelect) => {
        // [spaceEvent] is a PubNub Objects Space event.
        // In this app, these represent chat rooms.
        // The user can click one in the list to chat inside of that room.
        const alreadyInList = document.getElementById(spaceEvent.id);

        if (spaceEvent.event === CREATE_EVENT || spaceEvent.event === UPDATE_EVENT) {
            const chatRoomListDomElement = createUserListItem(spaceEvent.id, spaceEvent.name, true);
            if (alreadyInList) alreadyInList.remove();

            chatList.appendChild(chatRoomListDomElement);

            chatRoomListDomElement.addEventListener('click', (event) => {
                // Deselect the chat in the chat room list
                for (let i = 0; i < chatList.children.length; i++) {
                    chatList.children.item(i).classList.remove(SELECTED_CLASS);
                }

                // Select the new chat in the chat room list
                chatRoomListDomElement.classList.add(SELECTED_CLASS);

                let membersInChat;

                pubnub.getMembers(
                {
                    spaceId: spaceEvent.id,
                    limit: 100
                },
                (status, response) => {
                    if (status.statusCode !== 200) {
                        console.error(status, response);
                    } else {
                        let userHasJoinedChat = false;
                        membersInChat = response.data;
                        membersInChat.forEach((member) => {
                            if (member.id === pubnub.getUUID()){
                                userHasJoinedChat = true;
                            }

                            addToMemberList(member);
                        });

                        if (!userHasJoinedChat) {
                            // User joins the Objects space if they click on the chat
                            pubnub.joinSpaces({
                                userId: pubnub.getUUID(),
                                spaces: [{ id: spaceEvent.id }]
                            }, (joinSpacesStatus, joinSpacesResponse) => {
                                if (joinSpacesStatus.error) {
                                    console.error(joinSpacesStatus, joinSpacesResponse);
                                }
                            });
                        }
                    }
                });

                // Swap in this chat to the main view
                renderChat(spaceEvent.id, membersInChat);

                // Select the chat message input box automatically
                messageInput.focus();
            });

            let alreadySubscribed = false;
            for (let i = 0; i < channelsToSubscribeTo.length; i++) {
                if (channelsToSubscribeTo[i] === spaceEvent.id) {
                    alreadySubscribed = true;
                }
            }

            if (!alreadySubscribed) {
                channelsToSubscribeTo.push(spaceEvent.id);
                pubnub.subscribe({
                    channels: channelsToSubscribeTo
                });
            }

            if (autoSelect) {
                chatRoomListDomElement.classList.add(SELECTED_CLASS);
                renderChat(spaceEvent.id);
            }
        } else if (spaceEvent.event === DELETE_EVENT) {
            // Remove the chat from the UI list of Chat Rooms
            if (alreadyInList) alreadyInList.remove();

            // Remove channel from subscribe list
            channelsToSubscribeTo = channelsToSubscribeTo.filter(
                (channel) => channel !== spaceEvent.id
            );

            // Swap in the global chat to the main view
            chatList.children.item(0).classList.add(SELECTED_CLASS);
            renderChat(globalChannel);
        }
    };

    const createSpace = (newChatRoomId) => {
        newChatRoomId = typeof newChatRoomId !== 'string' ?
            fourCharID() : newChatRoomId;
        pubnub.createSpace(
            {
                id: newChatRoomId,
                name: newChatRoomId
            },
            (status, response) => {
                if (status.statusCode === 200) {
                    response.data.event = CREATE_EVENT;
                    modifyChatRoomList(response.data);
                } else {
                    console.error('Create Space Error:', status, response);
                }
            }
        );
    }

    const removeFromMemberList = (uuid) => {
        const div = document.getElementById(uuid);
        if (div) div.remove();
    };

    pubnub = new PubNub({
        publishKey : 'pub-c-8178220e-752c-42ab-82ae-ba202872fef3',
        subscribeKey : 'sub-c-eaafd854-d9a5-11e9-86fd-b2ac05a6ddd9'
    });

    // This PubNub listener powers the text chat and member user list population.
    pubnub.addListener({
        message: function(event) {
            // Render a message if the channel matches the currently selected chat
            if (event.channel === currentlySelectedChat) {
                renderMessage(event);
            }
        },
        user: (userEvent) => {

        },
        space: (spaceEvent) => {
            spaceEvent.message.data.event = spaceEvent.message.event;
            modifyChatRoomList(spaceEvent.message.data);
        },
        membership: (membershipEvent) => {

        }
    });

    channelsToSubscribeTo = [globalChannel];

    pubnub.subscribe({
        channels: channelsToSubscribeTo
    });

    // Get and render existing PubNub Objects Spaces
    pubnub.getSpaces(
        { limit: 3 },
        (status, response) => {
            // Array of JS objects for PubNub Objects Spaces
            const spaces = response.data;
            let globalSpaceHasBeenMade = false;
            spaces.forEach((space) => {
                if (space.id === globalChannel) globalSpaceHasBeenMade = true;
                space.event = CREATE_EVENT;
                modifyChatRoomList(space);
            });

            if (!globalSpaceHasBeenMade) {
                createSpace(globalChannel);
            }

            // Automatically select the global chat when the app loads
            chatList.children.item(0).classList.add(SELECTED_CLASS);
            renderChat(globalChannel);
        }
    );

    pubnub.getUsers({
        limit: 100
    }, (getUserStatus, getUserResponse) => {
        const users = getUserResponse.data;
        let userHasBeenMade = false;
        users.forEach((user) => {
            if (user.id === pubnub.getUUID()) userHasBeenMade = true;
        });

        if (!userHasBeenMade) {
            // First create this PubNub user in the Objects API
            pubnub.createUser(
                {
                    id: pubnub.getUUID(),
                    name: username
                },
                (createUserStatus, createUserResponse) => {
                    if (createUserStatus.error) {
                        console.error(createUserStatus, createUserResponse);
                    } else {
                        // PubNub user automatically joins the global chat when they load the page
                        pubnub.joinSpaces({
                            userId: pubnub.getUUID(),
                            spaces: [{ id: globalChannel }]
                        }, (joinSpacesStatus, joinSpacesResponse) => {
                            if (joinSpacesStatus.error) {
                                console.error(joinSpacesStatus, joinSpacesResponse);
                            }
                        });
                    }
                }
            );
        }
    });

    newChatRoomButton.addEventListener('click', createSpace);

    // Disconnect PubNub before a user navigates away from the page
    window.onbeforeunload = (event) => {
        pubnub.unsubscribe({
            channels: [globalChannel]
        });
    };
};

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// UI Render Functions
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function renderChat(chatRoomId, members) {
    // Set the chat channel to the newly selected chat's channel
    currentlySelectedChat = chatRoomId;

    // Clear out the message log from the previously selected chat
    log.innerHTML = '';

    // Render the 25 most recent chat messages for the newly selected chat
    pubnub.history(
        {
            channel: currentlySelectedChat,
            count: 25, // how many messages to fetch
            stringifiedTimeToken: true,
        },
        (status, response) => {
            for (let i = 0; i < response.messages.length; i++) {
                response.messages[i].message = response.messages[i].entry;
                delete response.messages[i].entry
            }

            response.messages.forEach(renderMessage);
        }
    );

    // Clear out and re-draw the members list for the newly selected chat
    memberList.innerHTML = '';

    if (!members) {
        pubnub.getMembers(
        {
            spaceId: chatRoomId,
            limit: 100
        },
        (status, response) => {
            members = response.data;
            members.forEach(addToMemberList);
        });
    } else {
        members.forEach(addToMemberList);
    }
}

function renderMessage(message) {
    const messageDomNode = createMessageHTML(message);

    log.append(messageDomNode);

    // Sort messages in chat log based on their timetoken (value of DOM id)
    sortNodeChildren(log, 'id');

    chat.scrollTop = chat.scrollHeight;
}

function getLocalUserName() {
    return new Promise((resolve) => {
        usernameInput.focus();
        usernameInput.value = '';

        usernameInput.addEventListener('keyup', (event) => {
            const nameLength = usernameInput.value.length;

            if (nameLength > 0) {
                joinButton.classList.remove('disabled');
            } else {
                joinButton.classList.add('disabled');
            }

            if (event.keyCode === 13 && nameLength > 0) {
                resolve(usernameInput.value);
            }
        });

        joinButton.addEventListener('click', (event) => {
            const nameLength = usernameInput.value.length;
            if (nameLength > 0) {
                resolve(usernameInput.value);
            }
        });
    });
}

function createUserListItem(id, name, isChat) {
    const div = document.createElement('div');
    div.id = id;

    const img = document.createElement('img');
    img.src = isChat ? './pubnub-chat-avatar.png' : './user.png';

    const span = document.createElement('span');
    span.innerHTML = name;

    div.appendChild(img);
    div.appendChild(span);

    const isGlobalChat = id === globalChannel;

    if (!isGlobalChat && isChat) {
        const deleteButton = document.createElement('div');
        deleteButton.innerText = 'x';
        deleteButton.classList.add('delete-button');

        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            pubnub.deleteSpace(id, (status) => {
                if (status.statusCode === 200) {
                    div.remove();
                }
            });
        });

        div.appendChild(deleteButton);
    }

    return div;
}

function createMessageHTML(messageEvent) {
    const text = messageEvent.message.text;
    const jsTime = parseInt(messageEvent.timetoken.substring(0,13));
    const dateString = new Date(jsTime).toLocaleString();
    const senderUuid = messageEvent.publisher;
    const senderName = messageEvent.message.sender_name;

    const div = document.createElement('div');
    const b = document.createElement('b');

    div.id = messageEvent.timetoken;
    b.innerHTML = `${senderName} (${dateString}): `;

    div.appendChild(b);
    div.innerHTML += text;

    return div;
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// Utility Functions
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function sendMessage() {
    const messageToSend = messageInput.value.replace(/\r?\n|\r/g, '');
    const trimmed = messageToSend.replace(/(\s)/g, '');

    if (trimmed.length > 0) {
        pubnub.publish({
            channel: currentlySelectedChat,
            message: {
                sender_name: username, // this can be spoofed in this implementation
                text: messageToSend
            }
        });
    }

    messageInput.value = '';
}

// Sorts sibling HTML elements based on an attribute value
function sortNodeChildren(parent, attribute) {
    const length = parent.children.length;
    for (let i = 0; i < length-1; i++) {
        if (parent.children[i+1][attribute] < parent.children[i][attribute]) {
            parent.children[i+1].parentNode
                .insertBefore(parent.children[i+1], parent.children[i]);
            i = -1;
        }
    }
}

/**
 * Get a new 4 character alphanumeric ID.
 *
 * @return {string} A unique ID for PubNub Object Spaces.
 */
function fourCharID() {
    const maxLength = 4;
    const possible = '1234567890qwertyuiopasdfghjklzxcvbnm';
    let text = '';

    for (let i = 0; i < maxLength; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}
