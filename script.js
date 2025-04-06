const SERVER_URL = "https://l7zagrwyb3oo0y-9000.proxy.runpod.net"; // Replace with your actual server URL
let racers = {};

function sendStartRequest() {
    const numRacers = document.getElementById("startRacers").value;
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
        updateStatus();
    })
    .catch(error => console.error("Error starting race:", error));
}

function sendCloseRequest() {
    const numRacers = document.getElementById("removeOnRacers").value;
    const userId = Object.keys(racers)[0];
    if (userId) {
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
            updateStatus();
        })
        .catch(error => console.error("Error closing race:", error));
    }
}

function updateStatus() {
    const statusDiv = document.getElementById("status");
    statusDiv.innerHTML = Object.keys(racers).map(user => user).join("<br>");
}

document.getElementById("startButton").addEventListener("click", sendStartRequest);
document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
