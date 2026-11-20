// when web load and console funcs
startChat()
//--\\
let msgTSend = document.getElementById("sendInput-msg");
let msgTSendBTN = document.getElementById("sendBtn-msg")
msgTSendBTN.addEventListener("click", function() {
    var content = msgTSend.value;
    sendMsg(content);
})
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