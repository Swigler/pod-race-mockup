<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pod Racer</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f7fa;
            color: #333;
        }
        h1, h2 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        .controls {
            margin-bottom: 20px;
            background-color: #fff;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .control-group {
            margin-bottom: 20px;
            padding: 15px;
            border-left: 4px solid #3498db;
            background-color: #f8f9fa;
            border-radius: 4px;
        }
        .control-group h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        button {
            padding: 10px 20px;
            margin-right: 10px;
            cursor: pointer;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: bold;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #2980b9;
        }
        button:disabled {
            background-color: #95a5a6;
            cursor: not-allowed;
        }
        .user-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            background-color: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .user-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .user-card h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        .user-card .pod-info {
            margin-top: 15px;
            padding: 15px;
            background-color: #f1f8ff;
            border-radius: 6px;
            border-left: 4px solid #3498db;
        }
        .status-pending {
            color: #f39c12;
            font-weight: bold;
        }
        .status-assigned {
            color: #27ae60;
            font-weight: bold;
        }
        .credit-controls {
            margin: 20px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .credit-controls input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-right: 10px;
        }
        .info-panel {
            background-color: #e8f4fc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #3498db;
        }
        #debug {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #fff;
            max-height: 300px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .timestamp {
            color: #7f8c8d;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <h1>Pod Racer Dashboard</h1>
    
    <div class="info-panel">
        <h3>How Pod Assignment Works</h3>
        <p>When you start a pod assignment, the system selects a pod from the pool and assigns it to your user. The pod is started and ready for use.</p>
        <p>Multiple users can be assigned pods simultaneously, limited only by available resources. If no pods are available, the system will attempt to create new ones.</p>
        <p>Each user is assigned a default of 3600 credits (1 hour). Credits are consumed at a rate of 1 per second while using a pod.</p>
    </div>
    
    <!-- User management controls -->
    <div class="controls">
        <h2>User Management</h2>
        <div class="control-group">
            <h3>1. Create User</h3>
            <p>Create a new user before assigning a pod.</p>
            <input type="text" id="createUserId" placeholder="User ID (optional)">
            <button id="createUserButton">Create User</button>
        </div>
        
        <div class="control-group">
            <h3>2. Assign Credits</h3>
            <p>Assign credits to a user. Credits are measured in seconds of pod usage time.</p>
            <input type="text" id="creditUserId" placeholder="User ID">
            <input type="number" id="creditAmount" placeholder="Credits (seconds)" value="3600">
            <button id="assignCreditsButton">Assign Credits</button>
        </div>
        
        <div class="control-group">
            <h3>3. Pod Controls</h3>
            <p>Start a pod assignment for a user with credits assigned.</p>
            <input type="text" id="podUserId" placeholder="User ID">
            <button id="startButton">Start Pod</button>
        </div>
    </div>
    
    <!-- Display active users -->
    <h2>Active Users</h2>
    <div id="userCards"></div>
    <div id="status"></div>
    
    <!-- Display debug messages -->
    <h2>Debug Log</h2>
    <div id="debug"></div>
    
    <!-- Load client-side logic -->
    <script src="script.js"></script>
</body>
</html>
