const SERVER_URL = "https://l7zagrwyb3oo0y-9000.proxy.runpod.net";  // Change if running locally
let racers = {};

function sendStartRequest() {
    const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    console.log("Starting race for:", userId);
    // Add to racers immediately to track the race as pending
    racers[userId] = { race_start: null, replacement_type: null, pending: true };
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
        if (data.status === "race_canceled") {
            console.log("Race was canceled early:", userId);
            delete racers[userId]; // Remove if canceled before completion
        } else {
            racers[userId] = { 
                race_start: data.race_start, 
                replacement_type: data.replacement_type, 
                pending: false 
            };
            console.log("Race started:", data);
        }
        updateStatus();
    })
    .catch(error => {
        console.error("Start error:", error);
        document.getElementById("status").innerHTML = "Error starting race: " + error.message;
        delete racers[userId]; // Clean up on error
        updateStatus();
    });
}

function sendCloseRequest() {
    const userIds = Object.keys(racers);
    if (userIds.length > 0) {
        const userId = userIds[0]; // Closes oldest race
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
        .catch(error => {
            console.error("Close error:", error);
            document.getElementById("status").innerHTML = "Error closing race: " + error.message;
        });
    } else {
        console.log("No race to close");
        document.getElementById("status").innerHTML = "No active races";
    }
}

function updateStatus() {
    const userIds = Object.keys(racers);
    document.getElementById("status").innerHTML = userIds.length > 0 ? userIds.join("<br>") : "No active races";
}

document.getElementById("startButton").addEventListener("click", sendStartRequest);
document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
