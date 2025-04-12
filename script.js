// Server URL (update to match your FastAPI server)
const SERVER_URL = "https://u962699roq0mvb-9000.proxy.runpod.net";
let racers = {};  // Tracks active races

function appendDebug(message) {
    // Add debug message to the debug div or console
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
    } else {
        console.log("Debug: " + message);
    }
}

function sendStartRequest() {
    // Generate a unique user ID
    const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    appendDebug("Starting race for: " + userId);
    racers[userId] = { race_start: null, pending: true };
    updateStatus();
    updateButtonState();
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
        updateStatus();
        updateButtonState();
    })
    .catch(error => {
        appendDebug("Start error: " + error.message);
        document.getElementById("status").innerHTML = "Error starting race: " + error.message;
        delete racers[userId];
        updateStatus();
        updateButtonState();
    });
}

function sendCloseRequest() {
    // Close the oldest active race
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
            updateButtonState();
        })
        .catch(error => {
            appendDebug("Close error: " + error.message);
            document.getElementById("status").innerHTML = "Error closing race: " + error.message;
            updateStatus();
            updateButtonState();
        });
    } else {
        appendDebug("No race to close");
        document.getElementById("status").innerHTML = "No active races";
        updateButtonState();
    }
}

function updateStatus() {
    // Update the status div with active user IDs
    const userIds = Object.keys(racers);
    document.getElementById("status").innerHTML = userIds.length > 0 ? userIds.join("<br>") : "No active races";
}

function updateButtonState() {
    // Disable the close button if no races are active
    const closeButton = document.getElementById("removeOnButton");
    closeButton.disabled = Object.keys(racers).length === 0;
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("startButton").addEventListener("click", sendStartRequest);
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
    updateButtonState();
});
