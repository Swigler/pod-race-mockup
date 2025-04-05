let isRaceRunning = false; // Tracks if a race is ongoing
let activeUsers = []; // Array of { user_id, pod_id }

// Start a race with the specified number of users
async function startRace() {
    const num = parseInt(document.getElementById("start_users").value);
    if (isRaceRunning) {
        alert("Race already running! Use 'Add Users' to join.");
        return;
    }
    if (num < 1) {
        alert("Enter a number greater than 0.");
        return;
    }
    isRaceRunning = true;
    for (let i = 0; i < num; i++) {
        const user_id = `user_${Date.now()}_${i}`;
        activeUsers.push({ user_id, pod_id: null });
        await sendStartRequest(user_id);
    }
    updateStatus();
}

// Add users while a race is running
async function addUsers() {
    if (!isRaceRunning) {
        alert("No race running! Use 'Start Race' first.");
        return;
    }
    const num = parseInt(document.getElementById("add_users").value);
    if (num < 1) {
        alert("Enter a number greater than 0.");
        return;
    }
    for (let i = 0; i < num; i++) {
        const user_id = `user_${Date.now()}_${i}`;
        activeUsers.push({ user_id, pod_id: null });
        await sendStartRequest(user_id);
    }
    updateStatus();
}

// Subtract users when no race is running
async function subtractUsersOff() {
    if (isRaceRunning) {
        alert("Race is running! Use 'Subtract (On)' instead.");
        return;
    }
    const num = parseInt(document.getElementById("subtract_off").value);
    if (num < 1) {
        alert("Enter a number greater than 0.");
        return;
    }
    await subtractUsers(num);
    updateStatus();
}

// Subtract users while a race is running
async function subtractUsersOn() {
    if (!isRaceRunning) {
        alert("No race running! Use 'Subtract (Off)' instead.");
        return;
    }
    const num = parseInt(document.getElementById("subtract_on").value);
    if (num < 1) {
        alert("Enter a number greater than 0.");
        return;
    }
    await subtractUsers(num);
    updateStatus();
}

// Send a start request to the connector
async function sendStartRequest(user_id) {
    try {
        const response = await fetch("http://localhost:9000/start_race", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id })
        });
        const data = await response.json();
        updateUserPod(user_id, data.pod_id);
    } catch (error) {
        console.error(`Error starting race for ${user_id}:`, error);
        updateUserPod(user_id, "error");
    }
}

// Subtract users by sending remove requests
async function subtractUsers(num) {
    const toRemove = activeUsers.slice(0, Math.min(num, activeUsers.length));
    for (const user of toRemove) {
        try {
            await fetch("http://localhost:9000/remove_user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: user.user_id })
            });
            activeUsers = activeUsers.filter(u => u.user_id !== user.user_id);
        } catch (error) {
            console.error(`Error removing ${user.user_id}:`, error);
        }
    }
    if (activeUsers.length === 0) {
        isRaceRunning = false;
    }
}

// Update a user's pod assignment
function updateUserPod(user_id, pod_id) {
    const user = activeUsers.find(u => u.user_id === user_id);
    if (user) {
        user.pod_id = pod_id;
    }
}

// Update the status display
function updateStatus() {
    const status = document.getElementById("status");
    status.innerText = activeUsers
        .map(u => `${u.user_id}: ${u.pod_id || "waiting"}`)
        .join("\n");
}
