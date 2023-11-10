import json
import os
import re
import requests

# Define graphical file extensions
GRAPHICAL_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.svg', '.webp', '.gif', '.bmp'}
# Define the relative path from the JSON file to the photos
PHOTOS_RELATIVE_PATH = "tools_around/photos/"

# Function to sanitize file names
def sanitize_filename(name):
    return re.sub(r'[^a-zA-Z0-9_\-.]', '_', name)

# Function to download an image from a URL
def download_image(url, path):
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raises an HTTPError if the HTTP request returned an unsuccessful status code
        with open(path, 'wb') as f:
            f.write(response.content)
    except requests.HTTPError as e:
        print(f"Failed to download image from {url}. HTTP Error: {e}")

# Function to extract the company logo URL from the questionAnswers
def get_company_logo_url(question_answers):
    for qa in question_answers:
        if qa.get('question') == "Company logo" and qa.get('answer'):
            return qa['answer']
    return ""

# Function to transform the speaker data to the new format
def transform_speaker_data(original_data):
    transformed_data = {"speakers": {}}
    photos_path = os.path.join('tools_around', 'photos')
    create_directory(photos_path)  # Ensure the photos directory exists

    for speaker in original_data:
        # Create a key by concatenating the first and last names
        key = f"{speaker['firstName']}__{speaker['lastName']}"
        # Remove spaces and convert to PascalCase
        key = key.replace(" ", "_")

        # Get the company logo URL if available
        companyLogoUrl = get_company_logo_url(speaker.get('questionAnswers', []))
        companyLogo = ""

        if companyLogoUrl:
            # Sanitize the URL to create a safe filename
            sanitized_url = sanitize_filename(companyLogoUrl)
            # Create the filename including the speaker name and sanitized URL
            filename = f"{speaker['firstName']}_{speaker['lastName']}_{sanitized_url}"
            image_path = os.path.join(photos_path, filename)

            _, ext = os.path.splitext(companyLogoUrl)
            if ext.lower() in GRAPHICAL_EXTENSIONS:
                # Download the image
                download_image(companyLogoUrl, image_path)
                # Update the companyLogo with the relative path
                companyLogo = f"/{os.path.join(PHOTOS_RELATIVE_PATH, filename)}"
            else:
                print(f"Non-graphical file extension found for speaker {speaker['fullName']}: {ext}")

        if not companyLogo:
            print(f"No company logo found for speaker {speaker['fullName']}")

        # Transform social links
        socials = []
        for link in speaker.get('links', []):
            socials.append({
                "icon": link["linkType"].lower(),
                "link": link["url"],
                "name": link["title"]
            })

        tagLine = speaker.get('tagLine', '')

        # Create the new structure
        transformed_data["speakers"][key] = {
            "name": speaker.get('fullName', ''),
            "bio": speaker.get('bio', ''),
            "shortBio": tagLine,
            "company": "",
            "companyLogo": companyLogo,
            "companyLogoUrl": "",
            "country": "",
            "featured": speaker.get('isTopSpeaker', False),
            "photo": "",
            "photoUrl": speaker.get('profilePicture', ''),
            "socials": socials,
            "order": 0,
            "title": tagLine
        }
    
    return transformed_data

# Function to create a directory if it doesn't exist
def create_directory(path):
    if not os.path.exists(path):
        os.makedirs(path)

# Function to read the original data
def read_original_data(filename):
    with open(filename, 'r', encoding='utf-8') as file:
        return json.load(file)

# Function to save the transformed data
def save_transformed_data(data, filename):
    with open(filename, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)

# Main function to orchestrate the transformation
def main():
    # Read the original data
    original_filename = 'speakers_data.json'
    original_data = read_original_data(original_filename)

    # Transform the data
    transformed_data = transform_speaker_data(original_data)

    # Save the transformed data
    transformed_filename = "transformed_speakers_data.json"
    save_transformed_data(transformed_data, transformed_filename)
    print(f"Transformed data saved to '{transformed_filename}'")

if __name__ == "__main__":
    main()

