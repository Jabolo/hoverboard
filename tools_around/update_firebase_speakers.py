import json
import os

# Function to read the JSON file
def read_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

# Function to write the JSON file
def write_json(data, file_path):
    with open(file_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=2)

# Function to update the default firebase data with transformed speakers, sessions, and schedule
def update_default_firebase_data(transformed_speakers_file, transformed_sessions_file, final_schedule_file, default_firebase_data_file):
    # Load the transformed speakers data
    transformed_speakers_data = read_json(transformed_speakers_file)
    # Load the transformed sessions data
    transformed_sessions_data = read_json(transformed_sessions_file)
    # Load the final schedule data
    final_schedule_data = read_json(final_schedule_file)
    # Load the default firebase data
    default_firebase_data = read_json(default_firebase_data_file)

    # Replace the speakers section in the default firebase data
    default_firebase_data['speakers'] = transformed_speakers_data['speakers']
    # Replace the sessions section in the default firebase data
    default_firebase_data['sessions'] = transformed_sessions_data['sessions']
    # Replace the schedule section in the default firebase data
    default_firebase_data['schedule'] = final_schedule_data['schedule']

    # Write the updated data back to the default firebase data file
    write_json(default_firebase_data, default_firebase_data_file)
    print(f"Updated speakers, sessions, and schedule data in {default_firebase_data_file}")

# Define the file paths relative to the current directory
transformed_speakers_file = 'transformed_speakers_data.json'
transformed_sessions_file = 'final_sessions_data.json'
final_schedule_file = 'final_schedule.json'
default_firebase_data_file = '../docs/default-firebase-data.json'

# Call the function to update the data
update_default_firebase_data(transformed_speakers_file, transformed_sessions_file, final_schedule_file, default_firebase_data_file)
