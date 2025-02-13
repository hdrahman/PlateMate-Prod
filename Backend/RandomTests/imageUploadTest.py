import requests

url = "http://127.0.0.1:8000/images/upload-image"
file_path = r"C:\Users\Haame\Downloads\Mockups\Platemate_mockup.jpg"

files = {"file": open(file_path, "rb")}
data = {"user_id": 1}

response = requests.post(url, files=files, data=data)

print(response.json())  # Print the API response
