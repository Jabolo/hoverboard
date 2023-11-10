import json
from datetime import datetime

def sanitize(data):
    if isinstance(data, dict):
        return {key: sanitize(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [sanitize(element) for element in data]
    elif data is None:
        return ""
    else:
        return data

def read_json(filename):
    with open(filename, 'r', encoding='utf-8') as file:
        data = json.load(file)
        return sanitize(data)

def write_json(data, filename):
    with open(filename, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)

def extract_date_and_time(iso_string):
    dt = datetime.fromisoformat(iso_string)
    return dt.strftime('%Y-%m-%d'), dt.strftime('%H:%M')

def main():
    # Read the data from the JSON files
    speakers_data = read_json('transformed_speakers_data.json')
    sessions_data = read_json('sessions_data.json')
    final_sessions = read_json('final_sessions_data.json')

    # Preparing the final schedule structure
    final_schedule = {"schedule": {}}

    # Assuming we're only dealing with one day
    timeslots_dict = {}
    tracks_set = set()

    # Iterate over the sessions to populate timeslots and tracks
    for session_group in sessions_data:
        for session in session_group['sessions']:
            start_date, start_time = extract_date_and_time(session['startsAt'])
            end_time = extract_date_and_time(session['endsAt'])[1]

            # Using session ID as reference to match with final_sessions_data
            session_key = next((key for key, value in final_sessions['sessions'].items()
                                if value['title'] == session['title']), None)

            # Skip if no matching session is found
            if not session_key:
                continue

            # Add the room to the set of tracks
            tracks_set.add(session['room'])

            # Create a timeslot if it doesn't exist
            if start_date not in final_schedule['schedule']:
                final_schedule['schedule'][start_date] = {
                    'dateReadable': datetime.fromisoformat(start_date).strftime('%B %d'),
                    'date': start_date,
                    'timeslots': []
                }

            # Add to timeslot dictionary
            timeslot_key = (start_date, start_time, end_time)
            if timeslot_key not in timeslots_dict:
                timeslots_dict[timeslot_key] = {
                    'startTime': start_time,
                    'endTime': end_time,
                    'sessions': []
                }
            # Create a new session entry with the session key
            timeslots_dict[timeslot_key]['sessions'].append({'items': [session_key]})

    # Sort and add timeslots to the final schedule
    for timeslot_key in sorted(timeslots_dict.keys()):
        final_schedule['schedule'][timeslot_key[0]]['timeslots'].append(timeslots_dict[timeslot_key])

    # Add the tracks
    for date in final_schedule['schedule']:
        final_schedule['schedule'][date]['tracks'] = [{'title': track} for track in sorted(tracks_set)]

    # Save the final schedule data
    write_json(final_schedule, 'final_schedule.json')

if __name__ == "__main__":
    main()
