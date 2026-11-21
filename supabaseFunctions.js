
// ==========================================
// CHATAPP - SUPABASE CONNECTION
// ==========================================

const usernameCache = new Map();

const SUPABASE_URL =
    "https://bbxokgjhblvcwxblijmp.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_H-N8EGo_EGWNgQ0smvTY0g_852AHfEF";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let activeUser = null;
let messageChannel = null;
let typingChannel = null;

let typingTimeout = null;
let isTyping = false;
let typingInput = null;

let sentMessages = new Set();

console.log("Supabase connected!");


// ==========================================
// 1. HTML ELEMENTS
// ==========================================

function getMessagesElement() {
    return document.getElementById("messages") ||
        window.messages ||
        null;
}

function getMessageInput() {
    return document.getElementById("message-input");
}


// ==========================================
// 2. REGISTER
// ==========================================

async function register(email, password, username) {

    const cleanUsername =
        String(username || "").trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        console.error("Invalid username!");
        return null;
    }

    if (!password || password.length < 6) {
        console.error("Password must be at least 6 characters.");
        return null;
    }

    const internalEmail = `${username.trim().toLowerCase()}@chat.invalid`;

    await supabaseClient.auth.signUp({
        email: internalEmail,
        password
    });

    const { data, error } =
        await supabaseClient.auth.signUp({
            email: internalEmail,
            password: password
        });

    if (error) {
        console.error("Registration failed:", error.message);
        return null;
    }

    activeUser = data.user;

    // Create profile if signup immediately provides a session.
    // Otherwise it will be created after the user logs in.
    if (data.session) {
        await createProfile(cleanUsername);
    }

    console.log("Account created!");

    return data.user;
}


// ==========================================
// 3. LOGIN
// ==========================================

async function login(emailOrUsername, password) {
    let email = emailOrUsername.trim().toLowerCase();

    if (!email.includes("@")) {
        email += "@chat.invalid";
    }

    console.log("Login email being used:", email);

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    if (error) {
        console.error("FULL LOGIN ERROR:", error);
        console.error("ERROR MESSAGE:", error.message);
        console.error("ERROR CODE:", error.code);

        return false;
    }

    console.log("LOGIN SUCCESS:", data.user);
    return true;
}


// ==========================================
// 4. GET USER
// ==========================================

async function getUser() {

    const { data, error } =
        await supabaseClient.auth.getUser();

    if (error) {
        if (error.name !== "AuthSessionMissingError") {
            console.error(error);
        }

        activeUser = null;
        return null;
    }

    activeUser = data.user;

    return data.user;
}


// ==========================================
// 5. START USER
// ==========================================

async function startUser() {

    const user = await getUser();

    if (!user) {
        console.log("Not logged in!");
        return null;
    }

    console.log(
        "Logged in as:",
        await getUsername(user.id)
    );

    return user;
}


// ==========================================
// 6. GET USERNAME
// ==========================================

async function getUsername(userId) {

    if (usernameCache.has(userId)) {
        return usernameCache.get(userId);
    }

    const { data, error } = await supabaseClient
        .from("usersa")
        .select("name")
        .eq("user_id", userId)
        .single();

    if (error) {
        console.error("Username lookup failed:", error);
        return "Unknown";
    }

    usernameCache.set(userId, data.name);

    return data.name;
}


// ==========================================
// 7. CREATE PROFILE (EDGE FUNCTION)
// ==========================================

async function createProfile(username) {

    const cleanUsername =
        String(username || "").trim().toLowerCase();

    const { data, error } =
        await supabaseClient.functions.invoke(
            "create-profile",
            {
                body: {
                    username: cleanUsername
                }
            }
        );

    if (error || !data?.success) {
        console.error("Profile creation failed:", error);
        return false;
    }

    console.log("Profile created!");

    usernameCache.delete(activeUser?.id);

    return true;
}


// ==========================================
// 8. DISPLAY MESSAGE WITH USERNAME
// ==========================================

function displayMsgWithUsername(
    msg,
    username,
    temporary = false
) {

    const messages = getMessagesElement();

    if (!messages) {
        console.error("Messages element not found!");
        return;
    }

    const div = document.createElement("div");

    div.className = "message";
    div.id = "msgBox";

    div.dataset.messageId = String(msg.id);
    div.dataset.messageContent = msg.content;
    div.dataset.pending = String(temporary);

    const name = document.createElement("strong");

    name.textContent =
        (username || "Unknown") + ": ";

    name.id = "msg-name";

    const content = document.createElement("span");

    content.textContent = msg.content;
    content.id = "msg-txt";

    div.append(name, content);

    messages.appendChild(div);

    messages.scrollTop = messages.scrollHeight;
}


// ==========================================
// 9. LOGOUT
// ==========================================

async function logout() {

    await stopTyping();

    if (messageChannel) {
        await supabaseClient.removeChannel(messageChannel);
        messageChannel = null;
    }

    if (typingChannel) {
        await supabaseClient.removeChannel(typingChannel);
        typingChannel = null;
    }

    const { error } =
        await supabaseClient.auth.signOut();

    if (error) {
        console.error(error);
        return;
    }

    activeUser = null;
    usernameCache.clear();
    sentMessages.clear();

    console.log("Logged out!");
}


// ==========================================
// 10. LOAD MESSAGES
// ==========================================

async function loadMsgs() {

    const { data, error } = await supabaseClient
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);

    if (error) {
        console.error(error);
        return;
    }

    const messages = getMessagesElement();

    if (!messages) {
        console.error("Messages element not found!");
        return;
    }

    messages.replaceChildren();

    for (const msg of data.reverse()) {
        await displayMsg(msg);
    }
}


// ==========================================
// 11. DISPLAY MESSAGE
// ==========================================

async function displayMsg(msg) {

    const messages = getMessagesElement();

    if (!messages) return;

    // Prevent duplicate messages.
    const alreadyExists =
        [...messages.children].some(
            el => el.dataset.messageId === String(msg.id)
        );

    if (alreadyExists) return;

    const username = await getUsername(msg.user_id);

    displayMsgWithUsername(msg, username);
}


// ==========================================
// 12. SEND MESSAGE (EDGE FUNCTION)
// ==========================================

async function sendMsg(content) {

    const user = await getUser();

    if (!user) {
        console.log("Login required!");
        return;
    }

    content = String(content || "").trim();

    if (!content || content.length > 1000) {
        return;
    }

    const messages = getMessagesElement();

    if (!messages) {
        console.error("Messages element not found!");
        return;
    }

    const username = await getUsername(user.id);

    // Create temporary message.
    const tempId =
        "temp-" + Date.now() + "-" + Math.random();

    const tempMsg = {
        id: tempId,
        user_id: user.id,
        content: content
    };

    // Display immediately.
    sentMessages.add(tempId);

    displayMsgWithUsername(
        tempMsg,
        username,
        true
    );

    // SEND TO BACKEND.
    const { data, error } =
        await supabaseClient.functions.invoke(
            "send-message",
            {
                body: {
                    content: content
                }
            }
        );

    if (error || !data?.message) {

        console.error("Message failed:", error);

        const tempElement =
            [...messages.children].find(
                el => el.dataset.messageId === tempId
            );

        tempElement?.remove();

        sentMessages.delete(tempId);

        return;
    }

    const savedMessage = data.message;
    const realId = String(savedMessage.id);

    // Replace temporary ID with real ID.
    const tempElement =
        [...messages.children].find(
            el => el.dataset.messageId === tempId
        );

    if (tempElement) {

        tempElement.dataset.messageId = realId;
        tempElement.dataset.pending = "false";

    } else {

        // Realtime may already have inserted the real message.
        const exists =
            [...messages.children].some(
                el => el.dataset.messageId === realId
            );

        if (!exists) {
            await displayMsg(savedMessage);
        }
    }

    sentMessages.delete(tempId);

    console.log("Message sent!");
}


// ==========================================
// 13. REALTIME MESSAGES
// ==========================================

function listenMsgs() {

    if (messageChannel) {
        supabaseClient.removeChannel(messageChannel);
    }

    messageChannel =
        supabaseClient.channel("global-chat");

    messageChannel
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages"
            },
            async (payload) => {

                const msg = payload.new;

                const messages = getMessagesElement();

                if (!messages) return;

                // Prevent duplicate messages.
                const exists =
                    [...messages.children].some(
                        el =>
                            el.dataset.messageId === String(msg.id)
                    );

                if (exists) return;

                // Match an optimistic message if one exists.
                const pending =
                    [...messages.children].find(
                        el =>
                            el.dataset.pending === "true" &&
                            el.dataset.messageContent === msg.content &&
                            activeUser &&
                            msg.user_id === activeUser.id
                    );

                if (pending) {

                    pending.dataset.messageId = String(msg.id);
                    pending.dataset.pending = "false";

                    return;
                }

                await displayMsg(msg);
            }
        )
        .on(
            "postgres_changes",
            {
                event: "DELETE",
                schema: "public",
                table: "messages"
            },
            (payload) => {

                const messages = getMessagesElement();

                if (!messages) return;

                const deletedId =
                    String(payload.old.id);

                const element =
                    [...messages.children].find(
                        el =>
                            el.dataset.messageId === deletedId
                    );

                element?.remove();
            }
        )
        .subscribe();

    return messageChannel;
}


// ==========================================
// 14. START CHAT
// ==========================================

async function startChat() {

    const user = await startUser();

    if (!user) return;

    await loadMsgs();

    listenMsgs();

    console.log("Chat started!");
}


// ==========================================
// 15. TYPING INDICATOR
// ==========================================

async function startTyping() {

    const user = await getUser();

    if (!user) return;

    if (typingChannel) {
        await supabaseClient.removeChannel(typingChannel);
    }

    typingChannel =
        supabaseClient.channel("global-typing");

    typingChannel
        .on(
            "broadcast",
            { event: "typing" },
            ({ payload }) => {

                if (payload.user_id === user.id) return;

                const indicator =
                    document.getElementById("typing-indicator");

                if (!indicator) return;

                indicator.textContent =
                    payload.typing
                        ? `${payload.username || "Someone"} is typing...`
                        : "";
            }
        )
        .subscribe();

    // Attach input listeners.
    typingInput = getMessageInput();

    if (typingInput) {
        typingInput.removeEventListener("input", sendTyping);
        typingInput.removeEventListener("blur", stopTyping);

        typingInput.addEventListener("input", sendTyping);
        typingInput.addEventListener("blur", stopTyping);
    }
}


// ==========================================
// 16. SEND TYPING STATUS
// ==========================================

async function sendTyping() {

    if (!typingChannel) return;

    const messageInput = getMessageInput();

    if (!messageInput) return;

    if (!messageInput.value.trim()) {
        await stopTyping();
        return;
    }

    if (!isTyping) {

        const user = await getUser();

        if (!user) return;

        const username = await getUsername(user.id);

        isTyping = true;

        await typingChannel.send({
            type: "broadcast",
            event: "typing",
            payload: {
                user_id: user.id,
                username: username,
                typing: true
            }
        });
    }

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
        stopTyping();
    }, 2000);
}


// ==========================================
// 17. STOP TYPING
// ==========================================

async function stopTyping() {

    clearTimeout(typingTimeout);

    if (!typingChannel || !isTyping) return;

    isTyping = false;

    const user = activeUser || await getUser();

    if (!user) return;

    await typingChannel.send({
        type: "broadcast",
        event: "typing",
        payload: {
            user_id: user.id,
            typing: false
        }
    });
}


// ==========================================
// 18. CREATE FRIEND (EDGE FUNCTION)
// ==========================================

async function createFriend(username, password) {

    const { data, error } =
        await supabaseClient.functions.invoke(
            "create-friend",
            {
                body: {
                    username,
                    password
                }
            }
        );

    if (error || !data?.success) {

        console.error("Account creation failed:", error);

        if (error?.context) {
            try {
                const details = await error.context.json();
                console.error("SERVER ERROR:", details);
            } catch {
                console.error("Could not read server error.");
            }
        }

        return null;
    }

    console.log("Friend account created:", data.username);

    return data;
}


// ==========================================
// 19. MAKE FUNCTIONS AVAILABLE GLOBALLY
// ==========================================

/*  i used ai to server so i had to put "AI-assisted materials" -_- and if i remix it its still ai,s code
        © 2026 @web-super-coder. All Rights Reserved.

        This website contains original content created by
        @web-super-coder, as well as certain AI-assisted
        materials.

        Original content is protected by applicable
        copyright laws. Third-party materials remain
        subject to their respective licenses and rights.
      
        version 1.0.0 beta*/
