import requests
import json

def fetch_data(url):
    # Send a GET request to the API
    response = requests.get(url)
    # Raise an exception if the request was unsuccessful
    response.raise_for_status()
    return response.json()

def save_data(data, filename):
    # Write the data to a file in JSON format
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def main():
    url = "https://sessionize.com/api/v2/enjwzldx/view/Sessions"
    try:
        # Fetch data from the API
        data = fetch_data(url)
        # Save the data to a file with a static name
        filename = "sessions_data.json"
        save_data(data, filename)
        print(f"Data successfully saved to '{filename}'")
    except requests.RequestException as e:
        print(f"An error occurred while fetching data: {e}")

if __name__ == "__main__":
    main()
