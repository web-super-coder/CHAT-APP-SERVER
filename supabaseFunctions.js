const SUPABASE_URL = "https://bbxokgjhblvcwxblijmp.supabase.co";
const SUPABASE_KEY = "sb_publishable_H-N8EGo_EGWNgQ0smvTY0g_852AHfEF";
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
supabaseClient
    .channel("global-chat");
console.log("Supabase connected!");
async function register(email, password, username) {

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        console.error(error.message);
        return;
    }

    const user = data.user;

    if (!user) return;

    const { error: profileError } = await supabaseClient
        .from("usersa")
        .insert({
            user_id: user.id,
            name: username
        });

    if (profileError) {
        console.error(profileError.message);
        return;
    }

    console.log("Account created!");
}
async function login(username, password) {
    const cleanUsername = username.trim().toLowerCase();

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email: `${cleanUsername}@chat.invalid`,
            password: password
        });

    if (error) {
        console.error("Login failed:", error.message);
        return null;
    }

    console.log("Logged in as:", username);
    return data.user;
}

async function startUser() {
    const user = await getUser();

    if (!user) {
        console.log("Not logged in!");
        return null;
    }

    console.log("Logged in as:", await getUsername(user.id));

    return user;
}


async function getUser() {
    const { data, error } =
        await supabaseClient.auth.getUser();

    if (error) {
        if (error.name !== "AuthSessionMissingError") {
            console.error(error);
        }

        return null;
    }

    return data.user;
}

async function getUsername(userId) {
    const { data, error } = await supabaseClient
        .from("usersa")
        .select("name")
        .eq("user_id", userId)
        .single();

    if (error) {
        console.error(error);
        return null;
    }

    return data.name;
}


async function register(email, password, username) {

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        console.error(error.message);
        return null;
    }

    if (!data.user) return null;


    if (!data.session) {
        console.log("Please confirm your email first.");
        return data.user;
    }

    const { error: profileError } = await supabaseClient
        .from("usersa")
        .insert({
            user_id: data.user.id,
            name: username
        });

    if (profileError) {
        console.error(profileError.message);
        return null;
    }

    console.log("Registered!");
    return data.user;
}


async function login(email, password) {

    const { data, error } = await supabaseClient.auth
        .signInWithPassword({
            email: email,
            password: password
        });

    if (error) {
        console.error(error.message);
        return null;
    }

    console.log("Logged in!");
    return data.user;
}


async function logout() {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error(error);
        return;
    }

    console.log("Logged out!");
}



async function createProfile(username) {

    const user = await getUser();

    if (!user) return;

    const { error } = await supabaseClient
        .from("usersa")
        .insert({
            user_id: user.id,
            name: username
        });

    if (error) {
        console.error(error);
        return;
    }

    console.log("Profile created!");
}



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

    messages.replaceChildren();

    for (const msg of data.reverse()) {
        await displayMsg(msg);
    }
}


async function displayMsg(msg) {

    const username = await getUsername(msg.user_id);

    const div = document.createElement("div");
    div.className = "message";
    div.id = "msgBox"
    div.dataset.messageId = msg.id;

    const name = document.createElement("strong");
    name.textContent = (username || "Unknown") + ": ";
    name.id = "msg-name";

    const content = document.createElement("span");
    content.textContent = msg.content;
    content.id = "msg-txt"

    div.append(name, content);

    messages.appendChild(div);

    requestAnimationFrame(() => {
    messages.scrollTop = messages.scrollHeight;
    });
}



async function sendMsg(content) {

    const user = await getUser();

    if (!user) {
        console.log("Login required!");
        return;
    }

    content = content.trim();

    if (!content || content.length > 2000) return;

    const { error } = await supabaseClient
        .from("messages")
        .insert({
            user_id: user.id,
            content: content
        });

    if (error) {
        console.error(error);
        return;
    }

    console.log("Message sent!");
}



function listenMsgs() {
    return supabaseClient
        .channel("global-chat")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages"
            },
            (payload) => {
                displayMsg(payload.new);
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
                const deletedId = payload.old.id;

                const element = [...messages.children].find(
                    el => el.dataset.messageId === deletedId
                );

                element?.remove();
            }
        )
        .subscribe();
}


async function startChat() {

    const user = await startUser();

    if (!user) return;

    await loadMsgs();

    listenMsgs();

    console.log("Chat started!");
}

// ==========================================
// 13. TYPING INDICATOR
// ==========================================

let typingChannel;
let typingTimeout;
let isTyping = false;


// Initialize typing channel
async function startTyping() {

    const user = await getUser();

    if (!user) return;

    const username = await getUsername(user.id);

    typingChannel = supabaseClient.channel("global-typing");

    typingChannel
        .on("broadcast", { event: "typing" }, ({ payload }) => {

            if (payload.user_id === user.id) return;

            document.getElementById("typing-indicator").textContent =
                payload.typing
                    ? `${payload.username} is typing...`
                    : "";
        })
        .subscribe();
}


// Send typing status
function sendTyping() {

    if (!typingChannel) return;

    const messageInput =
        document.getElementById("message-input");

    if (!messageInput.value.trim()) return;

    if (!isTyping) {
        isTyping = true;

        getUser().then(async user => {
            if (!user) return;

            const username = await getUsername(user.id);

            typingChannel.send({
                type: "broadcast",
                event: "typing",
                payload: {
                    user_id: user.id,
                    username: username,
                    typing: true
                }
            });
        });
    }

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
        stopTyping();
    }, 2000);
}


// Stop typing
async function stopTyping() {

    if (!typingChannel || !isTyping) return;

    isTyping = false;

    const user = await getUser();

    if (!user) return;

    typingChannel.send({
        type: "broadcast",
        event: "typing",
        payload: {
            user_id: user.id,
            typing: false
        }
    });
    messageInput.addEventListener("input", sendTyping);

    messageInput.addEventListener("blur", stopTyping);
}
Object.assign(window, {
    startUser,
    getUser,
    getUsername,
    register,
    login,
    logout,
    createProfile,
    loadMsgs,
    displayMsg,
    sendMsg,
    listenMsgs,
    startChat,
    startTyping,
    sendTyping,
    stopTyping
});
async function createFriend(username, password) {
    const { data, error } = await supabaseClient.functions.invoke(
        "create-friend",
        {
            body: { username, password }
        }
    );

    if (error) {
        console.error("Account creation failed:", error);

        if (error.context) {
            try {
                const details = await error.context.json();
                console.error("SERVER ERROR:", details);
            } catch {
                console.error("Could not read server error.");
            }
        }

        return;
    }

    console.log("SERVER RESPONSE:", data);
}