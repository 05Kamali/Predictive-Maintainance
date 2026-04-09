from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import joblib
import pandas as pd
from datetime import datetime
import sqlite3

app = FastAPI(title="Predictive Maintenance API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. State Management & Database
DB_FILE = "telemetry.db"
SYSTEM_CONFIG = {"anomaly_rate": 0.05} # Default 5% chance

class SettingsConfig(BaseModel):
    anomaly_rate: float

fleet_state = [
    {"id": "EQ-802", "type": "Robotic Arm", "status": "Healthy", "temp": 62.0, "rul": 450, "confidence": 98},
    {"id": "EQ-804", "type": "Conveyor Motor", "status": "Warning", "temp": 75.0, "rul": 45, "confidence": 82},
    {"id": "EQ-811", "type": "Hydraulic Press", "status": "Healthy", "temp": 55.0, "rul": 300, "confidence": 95},
    {"id": "EQ-815", "type": "CNC Router", "status": "Critical", "temp": 92.0, "rul": 3, "confidence": 91},
    {"id": "EQ-822", "type": "Packaging Unit", "status": "Healthy", "temp": 48.0, "rul": 500, "confidence": 99}
]

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            vibration REAL,
            temperature REAL,
            is_predicted_failure BOOLEAN,
            failure_probability REAL
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# 2. Load ML Model
model_filename = 'model.joblib'
try:
    model = joblib.load(model_filename)
except Exception as e:
    print(f"Warning: model.joblib not found. {e}")
    model = None


# ---- FRONTEND SERVING ---- 
@app.get("/")
def serve_index():
    return FileResponse("index.html")

@app.get("/styles.css")
def serve_css():
    return FileResponse("styles.css")

@app.get("/app.js")
def serve_js():
    return FileResponse("app.js")


# ---- API ROUTES ----
@app.post("/api/settings")
def update_settings(cfg: SettingsConfig):
    SYSTEM_CONFIG["anomaly_rate"] = cfg.anomaly_rate
    print(f"Server updated anomaly rate to {SYSTEM_CONFIG['anomaly_rate']}")
    return {"status": "ok"}

@app.get("/api/telemetry")
def get_live_telemetry():
    """Generates continuous feed running through Random Forest"""
    is_anomaly = random.random() < SYSTEM_CONFIG["anomaly_rate"]
    
    if is_anomaly:
        vib = random.uniform(5.0, 9.0)
        temp = random.uniform(85.0, 95.0)
    else:
        vib = random.uniform(1.0, 3.0)
        temp = random.uniform(65.0, 70.0)

    prediction = 0
    failure_probability = 0.0
    
    if model:
        features = pd.DataFrame({'vibration': [vib], 'temperature': [temp]})
        prediction = int(model.predict(features)[0])
        failure_probability = float(model.predict_proba(features)[0][1])

    data = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "vibration": round(vib, 2),
        "temperature": round(temp, 2),
        "is_predicted_failure": bool(prediction),
        "failure_probability": round(failure_probability * 100, 1)
    }

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO telemetry (timestamp, vibration, temperature, is_predicted_failure, failure_probability)
        VALUES (?, ?, ?, ?, ?)
    ''', (data['timestamp'], data['vibration'], data['temperature'], data['is_predicted_failure'], data['failure_probability']))
    conn.commit()
    conn.close()

    return data

@app.get("/api/equipment")
def get_equipment_status():
    """Returns dynamic simulated fleet conditions"""
    global fleet_state
    for eq in fleet_state:
        # Simulate physical engine wear
        if random.random() < SYSTEM_CONFIG["anomaly_rate"]:
            eq["temp"] += random.uniform(2.0, 6.0) # Heat build up
            eq["rul"] -= random.randint(1, 5) # Faster degradation
        else:
            eq["temp"] += random.uniform(-1.5, 1.0) # Mostly cooling or stable
        
        # Hard limits
        eq["temp"] = min(115.0, max(40.0, eq["temp"]))
             
        # Machine health logic
        if eq["temp"] > 88 or eq["rul"] < 10:
            eq["status"] = "Critical"
        elif eq["temp"] > 75 or eq["rul"] < 60:
            eq["status"] = "Warning"
        else:
            eq["status"] = "Healthy"
            
        eq["confidence"] = min(99, max(75, eq["confidence"] + random.randint(-1, 1)))

    return [
        {
            "id": eq["id"],
            "type": eq["type"],
            "status": eq["status"],
            "temp": f"{eq['temp']:.1f}\u00b0C",
            "rul": f"{max(0, eq['rul'])} Days",
            "confidence": f"{eq['confidence']}%"
        } for eq in fleet_state
    ]
