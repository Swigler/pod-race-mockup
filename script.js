const SERVER_URL = "https://u962699roq0mvb-9000.proxy.runpod.net";
let racers = {};

function appendDebug(message) {
    const debugDiv = document.getElementById("debug");
    if (debugDiv) debugDiv.innerHTML += message + "<br>";
    else console.log("Debug: " + message);
}

async function sendStartRequest() {
    const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    appendDebug("Starting race for: " + userId);
    racers[userId] = { race_start: null, pending: true };
    updateStatus();
    updateButtonState();
    try {
        const response = await fetch(SERVER_URL + "/start_race", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, key: "generate@123" })
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        const data = await response.json();
        appendDebug("Start response received");
        if (data.status === "no_pods_available") {
            appendDebug("No pods available for: " + userId);
            delete racers[userId];
        } else {
            racers[userId] = { 
                race_start: Date.now(), 
                winner: data.winner, 
                pods_raced: data.pods_raced, 
                pending: false 
            };
            appendDebug(`Race started for: ${userId}, Winner: ${data.winner}, Pods: ${data.pods_raced.join(", ")}`);
        }
    } catch (error) {
        appendDebug(`Start error: ${error.message}`);
        document.getElementById("status").innerHTML = `Error starting race: ${error.message}`;
        delete racers[userId];
    }
    updateStatus();
    updateButtonState();
}

async function sendCloseRequest() {
    const userIds = Object.keys(racers);
    appendDebug("Racers before close: " + userIds.join(", "));
    if (userIds.length > 0) {
        const userId = userIds[0];
        appendDebug("Closing race for: " + userId);
        try {
            const response = await fetch(SERVER_URL + "/close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, key: "generate@123" })
            });
            if (!response.ok) throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            appendDebug("Race closed for: " + userId);
            delete racers[userId];
        } catch (error) {
            appendDebug("Close error: " + error.message);
            document.getElementById("status").innerHTML = "Error closing race: " + error.message;
        }
        updateStatus();
        updateButtonState();
    } else {
        appendDebug("No race to close");
        document.getElementById("status").innerHTML = "No active races";
        updateButtonState();
    }
}

function updateStatus() {
    const userIds = Object.keys(racers);
    document.getElementById("status").innerHTML = userIds.length > 0 ? userIds.join("<br>") : "No active races";
}

function updateButtonState() {
    document.getElementById("removeOnButton").disabled = Object.keys(racers).length === 0;
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("startButton").addEventListener("click", sendStartRequest);
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
    updateButtonState();
});
