const SERVER_URL = "https://l7zagrwyb3oo0y-9000.proxy.runpod.net"; // Replace with your server URL
let racers = {};

function sendStartRequest() {
    const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    fetch(SERVER_URL + "/start_race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, key: "generate@123" })
    })
    .then(response => response.json())
    .then(data => {
        racers[userId] = {
            race_start: data.race_start,
            replacement_type: data.replacement_type
        };
        console.log("Started race for:", userId);
        updateStatus();
    })
    .catch(error => console.error("Error starting race:", error));
}

function sendCloseRequest() {
    const userId = Object.keys(racers)[0];
    if (userId) {
        console.log("Closing race for:", userId);
        fetch(SERVER_URL + "/close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                key: "generate@123",
                race_start: racers[userId].race_start,
                replacement_type: racers[userId].replacement_type
            })
        })
        .then(response => response.json())
        .then(data => {
            delete racers[userId];
            console.log("Closed race for:", userId);
            updateStatus();
        })
        .catch(error => console.error("Error closing race:", error));
    } else {
        console.log("No active race to close");
    }
}

function updateStatus() {
    const statusDiv = document.getElementById("status");
    statusDiv.innerHTML = Object.keys(racers).map(user => user).join("<br>");
}

document.getElementById("startButton").addEventListener("click", sendStartRequest);
document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
