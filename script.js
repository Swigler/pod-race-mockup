const SERVER_URL = "https://l7zagrwyb3oo0y-9000.proxy.runpod.net";
let racers = {};

function sendStartRequest() {
    const numRacers = document.getElementById("startRacers").value;
    const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    fetch(SERVER_URL + "/start_race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, key: "generate@123" }),
        timeout: 60000  // 60s timeout
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return response.json();
    })
    .then(data => {
        racers[userId] = {
            pod_id: data.pod_id || "unknown",  // Winner pod or unknown if stopped early
            race_start: data.race_start,
            replacement_type: data.replacement_type
        };
        updateStatus();
    })
    .catch(error => {
        console.error("Error starting race:", error);
        racers[userId] = { pod_id: "error", race_start: null, replacement_type: null };
        updateStatus();
    });
}

function sendCloseRequest() {
    const numRacers = document.getElementById("removeOnRacers").value;
    const userId = Object.keys(racers)[0];
    if (userId && racers[userId].race_start && racers[userId].replacement_type) {
        fetch(SERVER_URL + "/close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                key: "generate@123",
                race_start: racers[userId].race_start,
                replacement_type: racers[userId].replacement_type
            }),
            timeout: 60000  // 60s timeout
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            racers[userId].pod_id = "stopped";  // Show stopped if mid-race
            setTimeout(() => {
                delete racers[userId];
                updateStatus();
            }, 1000);  // Brief delay to show "stopped"
        })
        .catch(error => {
            console.error("Error closing race:", error);
            racers[userId].pod_id = "error";
            updateStatus();
        });
    } else {
        console.error("No valid race data for", userId);
    }
}

function updateStatus() {
    const statusDiv = document.getElementById("status");
    statusDiv.innerHTML = Object.entries(racers)
        .map(([user, info]) => `${user}: ${info.pod_id}`).join("<br>");
}

document.getElementById("startButton").addEventListener("click", sendStartRequest);
document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
