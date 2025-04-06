const SERVER_URL = "https://l7zagrwyb3oo0y-9000.proxy.runpod.net";  // Change if running locally
let racers = {};

function appendDebug(message) {
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
    } else {
        // Fallback to console if debug div is missing
        console.log("Debug (no div): " + message);
    }
}

function sendStartRequest() {
    const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    appendDebug("Starting race for: " + userId);
    racers[userId] = { race_start: null, replacement_type: null, pending: true };
    appendDebug("Racers set to: " + Object.keys(racers).join(", "));
    updateStatus();
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
        appendDebug("Start response received");
        if (data.status === "race_canceled") {
            appendDebug("Race canceled early: " + userId);
            delete racers[userId];
        } else {
            racers[userId] = { 
                race_start: data.race_start, 
                replacement_type: data.replacement_type, 
                pending: false 
            };
            appendDebug("Race started for: " + userId);
        }
        updateStatus();
    })
    .catch(error => {
        appendDebug("Start error: " + error.message);
        document.getElementById("status").innerHTML = "Error starting race: " + error.message;
        delete racers[userId];
        updateStatus();
    });
}

function sendCloseRequest() {
    const userIds = Object.keys(racers);
    appendDebug("Racers before close: " + userIds.join(", "));
    if (userIds.length > 0) {
        const userId = userIds[0]; // Closes oldest race
        appendDebug("Closing race for: " + userId);
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
            appendDebug("Race closed for: " + userId);
            delete racers[userId];
            updateStatus();
        })
        .catch(error => {
            appendDebug("Close error: " + error.message);
            document.getElementById("status").innerHTML = "Error closing race: " + error.message;
        });
    } else {
        appendDebug("No race to close");
        document.getElementById("status").innerHTML = "No active races";
    }
}

function updateStatus() {
    const userIds = Object.keys(racers);
    document.getElementById("status").innerHTML = userIds.length > 0 ? userIds.join("<br>") : "No active races";
}

// Ensure DOM is loaded before adding event listeners
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("startButton").addEventListener("click", sendStartRequest);
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
});
