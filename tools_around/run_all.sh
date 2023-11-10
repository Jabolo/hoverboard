#!/bin/bash

# Change directory to where the scripts are located, if they are in a subfolder
# cd path/to/scripts

# Run each script in order
python3 fetch_speakers_data.py
python3 transform_speakers_data.py
python3 fetch_sessions_data.py
python3 transform_sessions.py
python3 final_schedule.py
python3 update_firebase_data.py

echo "All scripts have been executed successfully."

