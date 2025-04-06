const SERVER_URL = "https://l7zagrwyb3oo0y-9000.proxy.runpod.net";  // Change if running locally
let racers = {};

function sendStartRequest() {
    const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    console.log("Starting race for:", userId);
    fetch(SERVER_URL + "/start_race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, key: "generate@123" })
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        return response.json();
    })
    .then(data => {
        racers[userId] = { race_start: data.race_start, replacement_type: data.replacement_type };
        console.log("Race started:", data);
        updateStatus();
    })
    .catch(error => console.error("Start error:", error));
}

function sendCloseRequest() {
    const userId = Object.keys(racers)[0];
    if (userId) {
        console.log("Closing race for:", userId);
        fetch(SERVER_URL + "/close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, key: "generate@123" })
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log("Race closed:", data);
            delete racers[userId];
            updateStatus();
        })
        .catch(error => console.error("Close error:", error));
    } else {
        console.log("No race to close");
    }
}

function updateStatus() {
    document.getElementById("status").innerHTML = Object.keys(racers).join("<br>");
}

document.getElementById("startButton").addEventListener("click", sendStartRequest);
document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
