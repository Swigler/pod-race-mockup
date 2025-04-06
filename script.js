const SERVER_URL = "https://l7zagrwyb3oo0y-9000.proxy.runpod.net";  // Change if running locally
let racers = {};

function appendDebug(message) {
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
    }
}

function sendStartRequest() {
    const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    appendDebug("Starting race for: " + userId);
    // Add to racers immediately to track the race as pending
    racers[userId] = { race_start: null, replacement_type: null, pending: true };
    appendDebug("Racers after set: " + JSON.stringify(racers));
    updateStatus(); // Show the userId in the UI right away
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
        appendDebug("Start response: " + JSON.stringify(data));
        if (data.status === "race_canceled") {
            appendDebug("Race was canceled early: " + userId);
            delete racers[userId]; // Remove if canceled before completion
        } else {
            racers[userId] = { 
                race_start: data.race_start, 
                replacement_type: data.replacement_type, 
                pending: false 
            };
            appendDebug("Race started: " + JSON.stringify(data));
        }
        updateStatus();
    })
    .catch(error => {
        appendDebug("Start error: " + error.message);
        document.getElementById("status").innerHTML = "Error starting race: " + error.message;
        delete racers[userId]; // Clean up on error
        updateStatus();
    });
}

function sendCloseRequest() {
    const userIds = Object.keys(racers);
    appendDebug("Racers before close: " + JSON.stringify(racers));
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
            appendDebug("Race closed: " + JSON.stringify(data));
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

document.getElementById("startButton").addEventListener("click", sendStartRequest);
document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
