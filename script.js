/**
 * Client-Side Logic for Pod Racer
 *
 * Handles race start/close requests and UI updates, polling for race status.
 */
 // Set this to your backend server URL
 let SERVER_URL = "https://u962699roq0mvb-6901.proxy.runpod.net/";
 
 // Function to update the SERVER_URL
 function setServerUrl(url) {
     if (!url || typeof url !== 'string' || !url.trim()) {
         appendDebug("Invalid URL provided");
         return false;
     }
     
     SERVER_URL = url.trim();
     console.log(`Backend URL updated to: ${SERVER_URL}`);
     appendDebug(`Backend URL updated to: ${SERVER_URL}`);
     
     // Update the display
     const urlDisplay = document.getElementById("currentBackendUrl");
     if (urlDisplay) {
         urlDisplay.textContent = SERVER_URL;
     }
     
     // Check connection with new URL
     checkBackendConnection();
     
     return true;
 }
 
 // Function to check if the backend is reachable
 async function checkBackendConnection() {
     try {
         appendDebug("Checking backend connection...");
         const response = await fetch(`${SERVER_URL}/status?user_id=test`, createFetchOptions("GET"));
         
         if (response.ok) {
             appendDebug("Backend connection successful!");
             return true;
         } else {
             appendDebug(`Backend connection failed: HTTP ${response.status}`);
             return false;
         }
     } catch (error) {
         appendDebug(`Backend connection error: ${error.message}`);
         return false;
     }
 }
 
 // Check connection on page load
 document.addEventListener("DOMContentLoaded", function() {
     checkBackendConnection();
 });
 
 // Helper function to create fetch options with CORS headers
 function createFetchOptions(method, body = null) {
     const options = {
         method: method,
         headers: {
             "Content-Type": "application/json",
             "Access-Control-Allow-Origin": "*"
         },
         mode: "cors"
     };
     
     if (body) {
         options.body = JSON.stringify(body);
     }
     
     return options;
 }
 let racers = {};
 
 function appendDebug(message) {
     /**
      * Append a debug message to the UI or console.
      */
     const debugDiv = document.getElementById("debug");
     if (debugDiv) {
         const now = new Date();
         const timestamp = now.toLocaleTimeString();
         
         // Format the message with timestamp and styling
         const formattedMessage = `<div><span class="timestamp">[${timestamp}]</span> ${message}</div>`;
         
         // Add the new message at the top
         debugDiv.innerHTML = formattedMessage + debugDiv.innerHTML;
         
         // Limit debug messages to prevent browser slowdown
         if (debugDiv.innerHTML.split('</div>').length > 100) {
             const lines = debugDiv.innerHTML.split('</div>');
             debugDiv.innerHTML = lines.slice(0, 100).join('</div>') + (lines.length > 100 ? '</div>' : '');
         }
     } else {
         console.log("Debug: " + message);
     }
 }
  
  async function check_queue_status(userId) {
      /**
       * Check if a user is in the queue
       */
      try {
          const response = await fetch(`${SERVER_URL}/queue_status?user_id=${userId}`, createFetchOptions("GET"));
          
          if (!response.ok) {
              // If the endpoint doesn't exist, just return null
              return null;
          }
          
          const data = await response.json();
          if (data.status === "queued") {
              appendDebug(`User ${userId} is in queue at position ${data.position}`);
              return {
                  status: "queued",
                  position: data.position,
                  estimated_wait: data.estimated_wait || 60
              };
          }
          
          return null;
      } catch (error) {
          // If there's an error, just return null
          return null;
      }
  }
  
  async function poll_race_status(userId) {
      /**
       * Poll the server for race status until assigned or failed.
       */
      for (let attempt = 1; attempt <= 30; attempt++) {
          try {
              const response = await fetch(`${SERVER_URL}/status?user_id=${userId}`, createFetchOptions("GET"));
              if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
              const data = await response.json();
              if (data.status === "assigned") {
                  // Our backend uses pod_type instead of winner and doesn't have pods_raced
                  const pod_type = data.pod_type || "unknown";
                  appendDebug(`Pod assigned for: ${userId}, Pod Type: ${pod_type}`);
                  racers[userId] = {
                      race_start: Date.now(),
                      winner: pod_type, // Use pod_type as winner
                      pods_raced: [pod_type], // Create a single-item array for pods_raced
                      pending: false,
                      credits: data.credits_remaining || 3600 // Use server-provided credits or default
                  };
                  appendDebug(`Remaining credits: ${data.credits_remaining || 3600}s`);
                  updateUserCards();
                  return true;
              } else if (data.status === "queued") {
                  // Handle queued status
                  appendDebug(`User ${userId} is in queue at position ${data.position}`);
                  racers[userId] = {
                      race_start: null,
                      winner: null,
                      pods_raced: [],
                      pending: true,
                      credits: data.credits || 3600,
                      queue_position: data.position,
                      estimated_wait: data.estimated_wait || 60
                  };
                  updateUserCards();
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  return false; // Continue polling
              } else if (data.status === "no_pod_assigned") {
                  // Check if user is in queue
                  const queueStatus = await check_queue_status(userId);
                  if (queueStatus) {
                      // User is in queue
                      racers[userId] = {
                          race_start: null,
                          winner: null,
                          pods_raced: [],
                          pending: true,
                          credits: racers[userId]?.credits || 3600,
                          queue_position: queueStatus.position,
                          estimated_wait: queueStatus.estimated_wait
                      };
                      updateUserCards();
                      await new Promise(resolve => setTimeout(resolve, 2000));
                      continue;
                  }
                  
                  if (attempt >= 10) {
                      appendDebug(`No pods available for: ${userId}`);
                      delete racers[userId];
                      return false;
                  }
              }
              // Still pending, update credits if provided
              if (data.credits_remaining !== undefined && racers[userId]) {
                  racers[userId].credits = data.credits_remaining;
                  updateUserCards();
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
              appendDebug(`Status poll error (attempt ${attempt}): ${error.message}`);
              if (attempt === 30) {
                  appendDebug(`Failed to get race status for: ${userId}`);
                  delete racers[userId];
                  return false;
              }
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
      }
      return false;
  }
  
  async function createUser() {
      /**
       * Create a new user without starting a race.
       */
      const userIdInput = document.getElementById("createUserId").value.trim();
      
      try {
          const response = await fetch(SERVER_URL + "/create_user", createFetchOptions("POST", {
              key: "generate@123",
              user_id: userIdInput || undefined // Only send if not empty
          }));
          
          if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
          
          const data = await response.json();
          appendDebug(`User created: ${data.user_id} with ${data.credits}s credits`);
          
          // Auto-fill the credit and race user ID fields
          document.getElementById("creditUserId").value = data.user_id;
          document.getElementById("raceUserId").value = data.user_id;
          
          return data.user_id;
      } catch (error) {
          appendDebug(`Error creating user: ${error.message}`);
          return null;
      }
  }
  
  async function sendStartRequest() {
      /**
       * Send a race start request and poll for status.
       */
      const userIdInput = document.getElementById("raceUserId").value.trim();
      
      if (!userIdInput) {
          appendDebug("Please enter a User ID or create a user first");
          return;
      }
      
      const userId = userIdInput;
      appendDebug("Starting race for: " + userId);
      racers[userId] = { race_start: null, pending: true, credits: 3600 }; // Default credits
      updateStatus();
      updateButtonState();
      for (let attempt = 1; attempt <= 3; attempt++) {
          try {
              const response = await fetch(SERVER_URL + "/start_pod", createFetchOptions("POST", {
                  user_id: userId,
                  key: "generate@123"
              }));
              if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
              const data = await response.json();
              appendDebug("Start response received");
              
              if (data.status === "queued") {
                  // User is in queue
                  appendDebug(`User ${userId} added to queue at position ${data.position}`);
                  racers[userId] = {
                      race_start: null,
                      winner: null,
                      pods_raced: [],
                      pending: true,
                      credits: data.credits || 3600,
                      queue_position: data.position,
                      estimated_wait: data.estimated_wait || 60
                  };
                  updateUserCards();
                  // Start polling for status
                  await poll_race_status(userId);
              } else if (data.status === "assigned") {
                  // User was assigned a pod immediately
                  const pod_type = data.pod_type || "unknown";
                  appendDebug(`Pod assigned for: ${userId}, Pod Type: ${pod_type}`);
                  racers[userId] = {
                      race_start: Date.now(),
                      winner: pod_type,
                      pods_raced: [pod_type],
                      pending: false,
                      credits: data.credits || 3600,
                      pod_url: data.pod_url
                  };
                  updateUserCards();
              } else {
                  appendDebug(`Unexpected status for ${userId}: ${data.status}`);
                  delete racers[userId];
              }
              break;
          } catch (error) {
              appendDebug(`Start error (attempt ${attempt}): ${error.message}`);
              if (attempt === 3) {
                  document.getElementById("status").innerHTML = `Error starting race: ${error.message}`;
                  delete racers[userId];
              }
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
      }
      updateStatus();
      updateButtonState();
      updateUserCards();
  }
  
  async function sendCloseRequest() {
      /**
       * Send a race close request.
       */
      const userIds = Object.keys(racers);
      appendDebug("Racers before close: " + userIds.join(", "));
      if (userIds.length > 0) {
          const userId = userIds[0];
          appendDebug("Closing race for: " + userId);
          document.getElementById("removeOnButton").disabled = true;
          
          let success = false;
          for (let attempt = 1; attempt <= 5; attempt++) {  // Increased max attempts
              try {
                  const response = await fetch(SERVER_URL + "/close", createFetchOptions("POST", {
                      user_id: userId,
                      key: "generate@123"
                  }));
                  
                  if (!response.ok) {
                      throw new Error(`HTTP error: ${response.status}`);
                  }
                  
                  appendDebug("Race closed for: " + userId);
                  delete racers[userId];
                  success = true;
                  break;
              } catch (error) {
                  appendDebug(`Close error (attempt ${attempt}): ${error.message}`);
                  
                  // Use exponential backoff with jitter for retries
                  const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
                  await new Promise(resolve => setTimeout(resolve, backoffTime));
              }
          }
          
          // If all attempts failed but this is a network error, assume success anyway
          // This prevents races from getting stuck in the UI when the server is unreachable
          if (!success) {
              appendDebug(`All close attempts failed for ${userId}. Assuming race closed.`);
              delete racers[userId];
          }
          
          updateStatus();
          updateButtonState();
          updateUserCards();
      } else {
          appendDebug("No race to close");
          document.getElementById("status").innerHTML = "No active races";
          updateButtonState();
      }
  }
  
  function updateStatus() {
      /**
       * Update the status div with active races.
       */
      const userIds = Object.keys(racers);
      document.getElementById("status").innerHTML = userIds.length > 0 ?
          `${userIds.length} active race(s)` :
          "No active races";
  }
  
  function updateUserCards() {
      /**
       * Update the user cards with detailed information.
       */
      const userCardsDiv = document.getElementById("userCards");
      const userIds = Object.keys(racers);
      
      if (userIds.length === 0) {
          userCardsDiv.innerHTML = "<p>No active races</p>";
          return;
      }
      
      let cardsHtml = "";
      
      userIds.forEach(userId => {
          const racer = racers[userId];
          const elapsedTime = racer.race_start ? Math.floor((Date.now() - racer.race_start) / 1000) : 0;
          // For display purposes, we'll show the client-side calculation
          // But the server is the source of truth for credits
          const remainingCredits = racer.credits ? racer.credits - elapsedTime : "Unknown";
          const statusClass = racer.pending ? "status-pending" : "status-assigned";
          
          // Format time remaining in a more readable format
          let timeDisplay = "";
          if (typeof remainingCredits === "number") {
              const hours = Math.floor(remainingCredits / 3600);
              const minutes = Math.floor((remainingCredits % 3600) / 60);
              const seconds = remainingCredits % 60;
              timeDisplay = `${hours}h ${minutes}m ${seconds}s`;
          } else {
              timeDisplay = remainingCredits;
          }
          
          // Check if user is in queue
          if (racer.queue_position !== undefined) {
              cardsHtml += `
                  <div class="user-card">
                      <h3>User: ${userId}</h3>
                      <p>Status: <span class="status-pending">In Queue</span></p>
                      <p>Queue Position: ${racer.queue_position}</p>
                      <p>Estimated Wait: ${Math.floor(racer.estimated_wait / 60)} minutes</p>
                      <p>Credits: ${racer.credits}</p>
                      
                      <div class="pod-info">
                          <h4>Queue Status</h4>
                          <p>Waiting in queue for available pod...</p>
                          <p><small>You will be assigned a pod when one becomes available. Your position in the queue: ${racer.queue_position + 1}</small></p>
                      </div>
                  </div>
              `;
          } else {
              cardsHtml += `
                  <div class="user-card">
                      <h3>User: ${userId}</h3>
                      <p>Status: <span class="${statusClass}">${racer.pending ? "Pending" : "Assigned"}</span></p>
                      <p>Race started: ${racer.race_start ? new Date(racer.race_start).toLocaleTimeString() : "Pending"}</p>
                      <p>Elapsed time: ${elapsedTime} seconds</p>
                      <p>Remaining credits: ${timeDisplay}</p>
                      
                      ${!racer.pending ? `
                      <div class="pod-info">
                          <h4>Pod Information</h4>
                          <p><strong>Winner pod:</strong> ${racer.winner || "Not assigned yet"}</p>
                          <p><strong>Pods raced:</strong> ${racer.pods_raced && racer.pods_raced.length ? racer.pods_raced.join(", ") : "None"}</p>
                          ${racer.pod_url ? `<p><strong>Pod URL:</strong> <a href="${racer.pod_url}" target="_blank">${racer.pod_url}</a></p>` : ''}
                          <p><small>This pod will be automatically released when your credits expire or when you close the race.</small></p>
                      </div>
                      ` : `
                      <div class="pod-info">
                          <h4>Race Status</h4>
                          <p>Waiting for pod assignment...</p>
                          <p><small>Pods are racing to determine the winner. This usually takes a few seconds.</small></p>
                      </div>
                      `}
                  </div>
              `;
          }
      });
      
      userCardsDiv.innerHTML = cardsHtml;
  }
  
  function updateButtonState() {
      /**
       * Enable/disable the Close button based on active races.
       */
      document.getElementById("removeOnButton").disabled = Object.keys(racers).length === 0;
  }
  
  async function assignCredits() {
      /**
       * Assign credits to a specific user.
       */
      const userId = document.getElementById("creditUserId").value.trim();
      const credits = parseInt(document.getElementById("creditAmount").value);
      
      if (!userId) {
          appendDebug("Please enter a valid User ID");
          return;
      }
      
      if (isNaN(credits) || credits <= 0) {
          appendDebug("Please enter a valid credit amount");
          return;
      }
      
      appendDebug(`Assigning ${credits} credits to user: ${userId}`);
      
      try {
          const response = await fetch(`${SERVER_URL}/assign_credits`, createFetchOptions("POST", {
              user_id: userId,
              credits: credits,
              key: "generate@123"
          }));
          
          if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
          
          const data = await response.json();
          appendDebug(`Credits assigned: ${data.status}`);
          
          // Update local state if this user is in our racers list
          if (userId in racers) {
              racers[userId].credits = credits;
              updateUserCards();
          }
      } catch (error) {
          appendDebug(`Error assigning credits: ${error.message}`);
      }
  }
  
  // Update user cards every second to show elapsed time and remaining credits
  setInterval(() => {
      if (Object.keys(racers).length > 0) {
          updateUserCards();
      }
  }, 1000);
  
  document.addEventListener("DOMContentLoaded", function() {
      /**
       * Initialize event listeners for buttons.
       */
      document.getElementById("createUserButton").addEventListener("click", createUser);
      document.getElementById("startButton").addEventListener("click", sendStartRequest);
      document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
      document.getElementById("assignCreditsButton").addEventListener("click", assignCredits);
      document.getElementById("checkConnectionButton").addEventListener("click", checkBackendConnection);
      
      // Add event listener for the update URL button
      document.getElementById("updateUrlButton").addEventListener("click", function() {
          const newUrl = document.getElementById("backendUrl").value;
          setServerUrl(newUrl);
      });
      
      // Update the current backend URL display
      document.getElementById("currentBackendUrl").textContent = SERVER_URL;
      
      updateButtonState();
      updateUserCards();
      
      // Add event listeners for Enter key in input fields
      document.getElementById("createUserId").addEventListener("keypress", function(e) {
          if (e.key === "Enter") createUser();
      });
      
      document.getElementById("backendUrl").addEventListener("keypress", function(e) {
          if (e.key === "Enter") {
              const newUrl = document.getElementById("backendUrl").value;
              setServerUrl(newUrl);
          }
      });
      
      document.getElementById("raceUserId").addEventListener("keypress", function(e) {
          if (e.key === "Enter") sendStartRequest();
      });
      
      document.getElementById("creditUserId").addEventListener("keypress", function(e) {
          if (e.key === "Enter") document.getElementById("creditAmount").focus();
      });
      
      document.getElementById("creditAmount").addEventListener("keypress", function(e) {
          if (e.key === "Enter") assignCredits();
      });
      
  });
