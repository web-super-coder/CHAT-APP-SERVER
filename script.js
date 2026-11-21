// when web load and console funcs
startChat()
//--\\
let msgTSend = document.getElementById("sendInput-msg");
let msgTSendBTN = document.getElementById("sendBtn-msg")
msgTSendBTN.addEventListener("click", function() {
    var content = msgTSend.value;
    if(content=="") {
        return;
    }
    if(content.length>=1000) {
        return;
    }
    sendMsg(content);
    msgTSend.value = "";
    let aniBox = document.createElement("div")
    aniBox.id = "msgAniSend";
    document.body.appendChild(aniBox)
})
let CopyrightBtn = document.getElementById("clickCopyright");
CopyrightBtn.addEventListener("click", function() {
    location.assign("/COPYRIGHT")
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
/*  i used ai to server so i had to put "AI-assisted materials" -_- and if i remix it its still ai,s code
        © 2026 @web-super-coder. All Rights Reserved.

        This website contains original content created by
        @web-super-coder, as well as certain AI-assisted
        materials.

        Original content is protected by applicable
        copyright laws. Third-party materials remain
        subject to their respective licenses and rights.
      
        version 1.0.0 beta*/
