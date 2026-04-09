import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib
import os

# 1. Generate Synthetic Data
# We are simulating sensor data for industrial motors
# Features: Vibration (mm/s), Temperature (C)
# Target: Failure (1) or Normal (0)

# Normal conditions
n_normal = 800
vib_normal = np.random.normal(loc=2.0, scale=0.5, size=n_normal)
temp_normal = np.random.normal(loc=65.0, scale=3.0, size=n_normal)

# Failure conditions (anomalies)
n_fail = 200
vib_fail = np.random.normal(loc=7.0, scale=1.5, size=n_fail) # Higher vibration
temp_fail = np.random.normal(loc=85.0, scale=5.0, size=n_fail) # Higher temperature

# Combine
vib = np.concatenate([vib_normal, vib_fail])
temp = np.concatenate([temp_normal, temp_fail])
target = np.concatenate([np.zeros(n_normal), np.ones(n_fail)])

# Create DataFrame
df = pd.DataFrame({
    'vibration': vib,
    'temperature': temp,
    'failure': target
})

# Shuffle
df = df.sample(frac=1).reset_index(drop=True)

X = df[['vibration', 'temperature']]
y = df['failure']

# 2. Train Model
print("Training Random Forest Classifier on mock sensor data...")
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X, y)

# Accuracy check on its own training set just for log output
score = clf.score(X, y)
print(f"Model trained with training accuracy: {score * 100:.2f}%")

# 3. Save Model
model_filename = 'model.joblib'
joblib.dump(clf, model_filename)
print(f"Model successfully saved to {model_filename}")
