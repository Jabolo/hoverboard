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

def create_session_key(speakers, title):
    if speakers:
        speaker_names = "_".join(speaker['name'].replace(" ", "__") for speaker in speakers)
        return f"{speaker_names}_{title.replace(' ', '_')}"
    else:
        return f"_{title.replace(' ', '_')}"

def format_speaker_name(name):
    return name.replace(" ", "__")

def main():
    speakers_data = read_json('transformed_speakers_data.json')
    sessions_data = read_json('sessions_data.json')

    final_sessions = {"sessions": {}}

    for session_group in sessions_data:
        group_name = session_group['groupName']
        for session in session_group['sessions']:
            session_key = create_session_key(session['speakers'], session['title'])
            formatted_speakers = [format_speaker_name(speaker['name']) for speaker in session['speakers']]
            final_sessions['sessions'][session_key] = {
                "description": session.get('description', ''),
                "tags": session.get('categories', []),
                "speakers": formatted_speakers,
                "presentation": session.get('liveUrl', ''),
                "title": session['title'],
                "complexity": "",
                "language": ""
            }
            print(f"Created session '{session_key}' from group '{group_name}' with title '{session['title']}' and speakers: {formatted_speakers}")

    write_json(final_sessions, 'final_sessions_data.json')

if __name__ == "__main__":
    main()
